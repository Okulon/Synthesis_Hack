/**
 * Shared allocation vote aggregation: legacy JSON or cycle vote-store;
 * proper formula: Σ (trust × share) × weight per asset, normalized.
 */
import fs from "fs";
import path from "path";

import { repoRoot } from "./env.mjs";
import { computeManagedCycle, pickAggregationCycleKey } from "./cycleClock.mjs";
import { loadVoteStore, voteStoreLocalPath } from "./voteStore.mjs";

export function loadLegacyVotes() {
  const local = path.join(repoRoot, "config/local/votes.json");
  const example = path.join(repoRoot, "apps/agent/fixtures/votes.example.json");
  const src = fs.existsSync(local) ? local : example;
  const j = JSON.parse(fs.readFileSync(src, "utf8"));
  const voters = j.voters ?? [];
  return { kind: "legacy", src, cycleId: Number(j.cycleId ?? 0), voters };
}

/**
 * @param {Array<{ trust?: number; weights?: Record<string, number>; address?: string }>} voters
 */
export function aggregateVotes(voters) {
  const acc = {};
  for (const v of voters) {
    const t = Number(v.trust ?? 1);
    if (t <= 0) continue;
    const w = v.weights ?? {};
    for (const [addr, wt] of Object.entries(w)) {
      const k = addr.toLowerCase();
      acc[k] = (acc[k] ?? 0) + t * Number(wt);
    }
  }
  const sum = Object.values(acc).reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error("no positive aggregated weights");
  const targets = {};
  for (const [k, v] of Object.entries(acc)) {
    targets[k] = v / sum;
  }
  const trustMass = voters.reduce((s, v) => s + Math.max(0, Number(v.trust ?? 1)), 0);
  return {
    targets,
    rawSum: sum,
    trustMass,
    mode: "trust_only_legacy",
    aggregationMode: "trust_only_legacy",
    warnings: [],
  };
}

const WEIGHT_SUM_EPS = 0.02;

/**
 * Last ballot wins per voter.
 * @param {import("./voteStore.mjs").Ballot[]} ballots
 */
function dedupeBallots(ballots) {
  const map = new Map();
  for (const b of ballots) {
    if (!b.voter) continue;
    map.set(b.voter.toLowerCase(), b);
  }
  return [...map.values()];
}

/**
 * @param {Record<string, number>} weights
 * @param {string} voter
 * @param {string[]} warnings
 */
function checkWeightSum(weights, voter, warnings) {
  const entries = Object.entries(weights);
  if (entries.length === 0) {
    warnings.push(`Voter ${voter}: empty weights`);
    return;
  }
  const s = entries.reduce((a, [, w]) => a + Number(w), 0);
  if (Math.abs(s - 1) > WEIGHT_SUM_EPS) {
    warnings.push(`Voter ${voter}: weights sum to ${s.toFixed(4)} (expected ~1)`);
  }
}

/**
 * @param {import("./voteStore.mjs").Ballot[]} ballots
 * @param {Record<string, number>} trustByVoter lowercase keys
 * @param {Record<string, string>} sharesByVoter lowercase keys, uint string
 * @param {{ requireShares?: boolean; defaultTrust?: number }} options
 */
export function aggregateBallots(ballots, trustByVoter, sharesByVoter, options = {}) {
  const { requireShares = false, defaultTrust = 1 } = options;
  const warnings = [];
  const unique = dedupeBallots(ballots);
  if (unique.length === 0) {
    return {
      targets: {},
      rawSum: 0,
      trustMass: 0,
      voters: [],
      warnings: [...warnings, "no ballots for this cycle"],
      aggregationMode: "none",
    };
  }

  const acc = {};
  const voterRows = [];

  for (const b of unique) {
    const voter = b.voter.toLowerCase();
    checkWeightSum(b.weights, voter, warnings);

    const trust = Number(trustByVoter[voter] ?? defaultTrust);
    if (trust <= 0) {
      warnings.push(`Voter ${voter}: trust <= 0, skipped`);
      continue;
    }

    const shareStr = sharesByVoter[voter];
    const hasShare =
      shareStr != null &&
      shareStr !== "" &&
      !Number.isNaN(Number(shareStr)) &&
      BigInt(shareStr) > 0n;

    if (requireShares && !hasShare) {
      throw new Error(`Missing share snapshot for voter ${voter} (set snapshot or use AGGREGATE_STRICT_SHARES=0)`);
    }

    let power;
    if (hasShare) {
      power = trust * (Number(BigInt(shareStr)) / 1e18);
    } else {
      power = trust;
      warnings.push(`Voter ${voter}: no snapshot share — using trust-only (unit share)`);
    }

    if (power <= 0) continue;

    const w = b.weights ?? {};
    for (const [addr, wt] of Object.entries(w)) {
      const k = addr.toLowerCase();
      acc[k] = (acc[k] ?? 0) + power * Number(wt);
    }

    voterRows.push({
      voter,
      trust,
      share1e18: hasShare ? shareStr : null,
      votingPower: power,
    });
  }

  const sum = Object.values(acc).reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error("no positive aggregated weights after filtering voters");
  const targets = {};
  for (const [k, v] of Object.entries(acc)) {
    targets[k] = v / sum;
  }

  const missingShare = voterRows.filter((r) => r.share1e18 == null);
  const aggregationMode =
    missingShare.length === 0 && voterRows.length > 0
      ? "share_trust"
      : missingShare.length === voterRows.length
        ? "trust_only"
        : "mixed";

  return {
    targets,
    rawSum: sum,
    trustMass: voterRows.reduce((s, r) => s + r.trust, 0),
    voters: voterRows,
    warnings,
    aggregationMode,
  };
}

/**
 * Resolve input: local vote-store overrides legacy when present.
 * @returns {Promise<{ kind: 'store'; src: string; cycleKey: string; cycle: import("./voteStore.mjs").CycleEntry } | { kind: 'legacy'; src:
 * string; cycleId: number; voters: any[] }>}
 */
export function resolveVoteAggregationInput() {
  const localStorePath = voteStoreLocalPath();
  const localLegacy = path.join(repoRoot, "config/local/votes.json");

  if (fs.existsSync(localStorePath)) {
    const { path: src, store } = loadVoteStore();
    const managed = computeManagedCycle();
    const cycleKey = pickAggregationCycleKey(store, managed);
    const cycle = store.cycles[String(cycleKey)];
    if (!cycle) throw new Error(`vote-store: no cycle "${cycleKey}"`);
    return { kind: "store", src, cycleKey, cycle, store, managed };
  }

  if (fs.existsSync(localLegacy)) {
    const j = JSON.parse(fs.readFileSync(localLegacy, "utf8"));
    return {
      kind: "legacy",
      src: localLegacy,
      cycleId: Number(j.cycleId ?? 0),
      voters: j.voters ?? [],
    };
  }

  const { path: src, store } = loadVoteStore();
  const managed = computeManagedCycle();
  const cycleKey = pickAggregationCycleKey(store, managed);
  const cycle = store.cycles[String(cycleKey)];
  if (!cycle) throw new Error(`vote-store: no cycle "${cycleKey}"`);
  return { kind: "store", src, cycleKey, cycle, store, managed };
}
