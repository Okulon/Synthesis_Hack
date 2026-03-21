/**
 * Off-chain Tier-A: after each closeCycle, split positive cycle profit across ballot voters
 * with weights ∝ trust_before × shares (same power model as allocation aggregate).
 *
 * When TESTGAINS is set (bigint string, NAV 1e18 scale), each exported cycle draws a random pool
 * uniformly in [-T/2, T] (bigint), then clamps to ≥0 for splitting (negative/zero → no payout that row).
 */
import { randomBytes } from "node:crypto";
import fs from "fs";
import path from "path";

import { repoRoot } from "./env.mjs";
import { buildPerVoterHistory, loadCsv, loadScoring } from "./trustCore.mjs";
import { loadVoteStore } from "./voteStore.mjs";

const CLOSE_LOG = path.join(repoRoot, "config/local/cycle-close-log.json");
const OUT = path.join(repoRoot, "frontend/public/cycle-profits.json");

function dedupeBallots(ballots) {
  const map = new Map();
  for (const b of ballots ?? []) {
    if (!b.voter) continue;
    map.set(b.voter.toLowerCase(), b);
  }
  return [...map.values()];
}

function share1e18ForVoter(sharesMap, voter) {
  const v = voter.toLowerCase();
  if (sharesMap == null) return undefined;
  if (sharesMap[v] != null) return sharesMap[v];
  for (const [k, val] of Object.entries(sharesMap)) {
    if (k.toLowerCase() === v) return val;
  }
  return undefined;
}

/** @returns {bigint | null} upper bound T (≥0); null if unset */
export function parseTestGains1e18() {
  const g = process.env.TESTGAINS;
  if (g === undefined || g === "") return null;
  try {
    const v = BigInt(String(g).trim());
    return v <= 0n ? null : v;
  } catch {
    return null;
  }
}

/** Uniform random bigint in [lo, hi] inclusive (lo ≤ hi). */
function randomBigIntInclusive(lo, hi) {
  const span = hi - lo + 1n;
  const buf = randomBytes(32);
  let x = 0n;
  for (let i = 0; i < buf.length; i++) x = (x << 8n) + BigInt(buf[i]);
  return lo + (x % span);
}

/**
 * One synthetic profit draw: sample x ~ U[-T/2, T], return max(0n, x) for the split pool.
 * @param {bigint} T
 * @returns {{ pool1e18: bigint, rawSample1e18: bigint }}
 */
export function sampleTestGainsPool1e18(T) {
  if (T <= 0n) return { pool1e18: 0n, rawSample1e18: 0n };
  const half = T / 2n;
  const lo = -half;
  const hi = T;
  const raw = randomBigIntInclusive(lo, hi);
  const pool = raw > 0n ? raw : 0n;
  return { pool1e18: pool, rawSample1e18: raw };
}

export function loadCloseLog() {
  if (!fs.existsSync(CLOSE_LOG)) return { version: 1, entries: [] };
  try {
    const j = JSON.parse(fs.readFileSync(CLOSE_LOG, "utf8"));
    return { version: 1, entries: Array.isArray(j.entries) ? j.entries : [] };
  } catch {
    return { version: 1, entries: [] };
  }
}

/**
 * @param {bigint} profit
 * @param {Record<string, number>} powers lowercase voter -> positive float
 * @returns {Record<string, string>} voter -> allocation string bigint
 */
export function splitProfitByPower(profit, powers) {
  const list = Object.entries(powers).filter(([, p]) => p > 0 && Number.isFinite(p));
  if (list.length === 0 || profit <= 0n) return {};

  const SCALE = 1_000_000n;
  const scaled = list.map(([addr, p]) => {
    const w = BigInt(Math.max(1, Math.floor(p * Number(SCALE))));
    return [addr.toLowerCase(), w];
  });
  const W = scaled.reduce((s, [, w]) => s + w, 0n);

  /** @type {Record<string, bigint>} */
  const raw = {};
  let sum = 0n;
  for (const [a, w] of scaled) {
    const q = (profit * w) / W;
    raw[a] = q;
    sum += q;
  }
  let rem = profit - sum;
  const keys = Object.keys(raw).sort();
  let i = 0;
  while (rem > 0n && keys.length > 0) {
    const k = keys[i % keys.length];
    raw[k] += 1n;
    rem -= 1n;
    i += 1;
  }

  /** @type {Record<string, string>} */
  const out = {};
  for (const [a, v] of Object.entries(raw)) out[a] = v.toString();
  return out;
}

/**
 * Last close wins per wall-clock index (retries / duplicate logs).
 * @param {any[]} entries
 */
/**
 * Dedupe by attribution key: prefer wall-clock index; else synthetic key `onchain:<beforeClose>`.
 */
function latestEntryPerAttribution(entries) {
  const map = new Map();
  for (const e of entries) {
    if (e == null) continue;
    let k;
    if (e.wallClockIndex !== undefined && e.wallClockIndex !== null) {
      k = `w:${e.wallClockIndex}`;
    } else if (e.onChainCycleIdBeforeClose != null) {
      k = `c:${e.onChainCycleIdBeforeClose}`;
    } else {
      k = `tx:${e.txHash ?? e.closedAt ?? Math.random()}`;
    }
    const prev = map.get(k);
    if (!prev) {
      map.set(k, e);
      continue;
    }
    const tNew = Date.parse(e.closedAt ?? "") || 0;
    const tOld = Date.parse(prev.closedAt ?? "") || 0;
    if (tNew >= tOld) map.set(k, e);
  }
  return [...map.values()].sort((a, b) => {
    const ta = Date.parse(a.closedAt ?? "") || 0;
    const tb = Date.parse(b.closedAt ?? "") || 0;
    return ta - tb;
  });
}

/**
 * Map a close log entry to vote-store cycle key (ballots / shares for that allocation period).
 */
function voteStoreKeyForCloseEntry(store, e) {
  if (e.wallClockIndex !== undefined && e.wallClockIndex !== null) {
    return String(e.wallClockIndex);
  }
  const target = e.onChainCycleIdBeforeClose;
  if (target == null) return null;
  for (const [k, c] of Object.entries(store.cycles ?? {})) {
    if (Number(c?.onChainCycleId) === Number(target)) return k;
  }
  return String(target);
}

function trustBeforeForCycle(historyByVoter, voter, cycleKey, defaultTrust) {
  const steps = historyByVoter[voter];
  if (!steps?.length) return defaultTrust;
  const step = steps.find((s) => String(s.cycle_id) === String(cycleKey));
  return step ? step.trust_before : defaultTrust;
}

/**
 * @returns {object} JSON payload for cycle-profits.json
 */
export function buildCycleProfitsPayload() {
  const scoring = loadScoring();
  const { rows } = loadCsv();
  const historyByVoter = buildPerVoterHistory(rows, scoring);
  const { store } = loadVoteStore();
  const testGains = parseTestGains1e18();
  const log = loadCloseLog();
  const entries = latestEntryPerAttribution(log.entries);

  const cycles = [];
  for (const e of entries) {
    const key = voteStoreKeyForCloseEntry(store, e);
    const cycle = key != null ? store.cycles?.[key] : undefined;
    const navStart = BigInt(e.navStart1e18 ?? "0");
    const navEnd = BigInt(e.navEnd1e18 ?? "0");
    let navDelta;
    try {
      navDelta = navEnd - navStart;
    } catch {
      navDelta = 0n;
    }

    const navProfit = navDelta > 0n ? navDelta : 0n;
    let profit1e18 = navProfit;
    let profitSource = "nav_delta";
    /** @type {string | null} */
    let testGainsRawSample1e18 = null;
    if (testGains != null) {
      const { pool1e18, rawSample1e18 } = sampleTestGainsPool1e18(testGains);
      profit1e18 = pool1e18;
      profitSource = "testgains";
      testGainsRawSample1e18 = rawSample1e18.toString();
    }

    let resolveWarning = null;
    if (key == null) {
      resolveWarning =
        "Could not map this close to a vote-store cycle (set CLOSE_CYCLE_WALL_KEY from agent or align onChainCycleId).";
    } else if (!cycle) {
      resolveWarning = `vote-store has no cycle "${key}" — ballots / shares unavailable for split.`;
    }

    const ballots = dedupeBallots(cycle?.ballots);
    const sharesMap = cycle?.shares1e18 ?? {};

    /** @type {Record<string, number>} */
    const powers = {};
    const participantMeta = [];

    for (const b of ballots) {
      const voter = b.voter.toLowerCase();
      const trust = trustBeforeForCycle(historyByVoter, voter, key, scoring.defaultTrust);
      const shareStr = share1e18ForVoter(sharesMap, voter);
      const hasShare =
        shareStr != null &&
        shareStr !== "" &&
        !Number.isNaN(Number(shareStr)) &&
        BigInt(shareStr) > 0n;
      const shareFloat = hasShare ? Number(BigInt(shareStr)) / 1e18 : 0;
      const power = hasShare ? trust * shareFloat : trust;
      if (power <= 0 || !Number.isFinite(power)) continue;
      powers[voter] = power;
      participantMeta.push({
        address: voter,
        trustBefore: trust,
        shares1e18: hasShare ? String(shareStr) : null,
        power,
      });
    }

    const powerSum = Object.values(powers).reduce((a, b) => a + b, 0);
    const allocations = splitProfitByPower(profit1e18, powers);

    participantMeta.sort((a, b) => {
      const av = BigInt(allocations[a.address] ?? "0");
      const bv = BigInt(allocations[b.address] ?? "0");
      if (av === bv) return a.address.localeCompare(b.address);
      return av < bv ? 1 : -1;
    });

    const enriched = participantMeta.map((p) => ({
      ...p,
      weight: powerSum > 0 ? p.power / powerSum : 0,
      allocation1e18: allocations[p.address] ?? "0",
    }));

    let allocSum = 0n;
    for (const p of enriched) allocSum += BigInt(p.allocation1e18 ?? "0");

    cycles.push({
      wallClockIndex: e.wallClockIndex != null ? Number(e.wallClockIndex) : null,
      voteStoreCycleKey: key,
      onChainCycleIdBeforeClose: e.onChainCycleIdBeforeClose ?? null,
      onChainCycleIdAfterClose: e.onChainCycleIdAfterClose ?? null,
      closedAt: e.closedAt ?? null,
      txHash: e.txHash ?? null,
      navStart1e18: e.navStart1e18 ?? "0",
      navEnd1e18: e.navEnd1e18 ?? "0",
      navDelta1e18: navDelta.toString(),
      profitPool1e18: profit1e18.toString(),
      profitSource,
      navProfit1e18: navProfit.toString(),
      participantCount: enriched.length,
      totalPower: powerSum,
      participants: enriched,
      allocationSum1e18: allocSum.toString(),
      allocationMatchesPool: enriched.length === 0 || allocSum === profit1e18,
      resolveWarning,
      testGainsRawSample1e18,
    });
  }

  const testGainsRange =
    testGains != null
      ? { min1e18: (-(testGains / 2n)).toString(), max1e18: testGains.toString(), poolClamp: "max(0, sample)" }
      : null;

  return {
    unit: "vault totalNAV scale (1e18 fixed-point)",
    testGainsActive: testGains != null,
    testGains1e18: testGains != null ? testGains.toString() : null,
    testGainsRange,
    cycles,
    _meta: {
      closeLogPath: path.relative(repoRoot, CLOSE_LOG).replace(/\\/g, "/"),
      updatedAt: new Date().toISOString(),
      note:
        "Regenerated by profit:export or automatically after closeCycle. Weights: trust_before × shares (or trust-only if no snapshot)." +
        (testGains != null
          ? " TESTGAINS: each cycle gets an independent uniform draw in [-T/2, T]; profit pool = max(0, draw)."
          : ""),
    },
  };
}

export function writeCycleProfitsArtifact() {
  const payload = buildCycleProfitsPayload();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  return OUT;
}
