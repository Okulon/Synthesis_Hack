/**
 * After a wall-clock cycle ends: compute time-weighted portfolio return per voter and upsert trust_cycle.csv.
 *
 * timeWeight = (cycleEnd - voteTime) / cycleDuration  (clamped to [0,1], voteTime clamped into [cycleStart, cycleEnd])
 * effectiveReturn = portfolioReturn(from vote priceMarksUsdc to live USDC mids) × timeWeight
 *
 * CSV vote_return_bps = round(effectiveReturn * 10000). Use scoring.yaml update_rule: time_weighted_portfolio_return.
 *
 * Env:
 *   CHAIN_RPC_URL, optional CHAIN_ID
 *   TRUST_FINALIZE_CYCLE_KEY — default: previous window (managed.index - 1)
 *
 * Requires: cycle-clock.json + vote-store with ballots that have priceMarksUsdc (run trust:stamp-prices at vote time).
 *
 * Optional: TESTBOOSTTRUST — positive multiplier on effective return before bps rounding (dev only; default 1).
 * Optional: TRUST_MIN_TIME_WEIGHT_FLOOR — e.g. 0.25 clamps time weight up to 0.25 so votes near cycle
 *   end still get non-zero effective return (dev / demos). Default: use raw time weight (vote at end → 0).
 */
import fs from "fs";
import path from "path";

import { fetchUsdcPricesForTokens, loadChainYaml, makeChainClient } from "./lib/assetPrices.mjs";
import { computeManagedCycle, ensureCycleClockReady, loadCycleClockState } from "./lib/cycleClock.mjs";
import { repoRoot } from "./lib/env.mjs";
import {
  cycleWindowBounds,
  lastBallotByVoter,
  portfolioReturnDecimal,
  timeWeightRemainingInCycle,
  voteUnixFromSubmittedAt,
} from "./lib/trustPortfolio.mjs";
import { getTestBoostTrustMultiplier } from "./lib/testBoostTrust.mjs";
import { getCycle, loadVoteStore } from "./lib/voteStore.mjs";

/** 0..1; if set, time weight is max(raw, floor) so end-of-window votes are not forced to 0 P&L. */
function timeWeightWithOptionalFloor(twRaw) {
  const raw = process.env.TRUST_MIN_TIME_WEIGHT_FLOOR;
  if (raw === undefined || raw === "") return { tw: twRaw, twRaw, floorApplied: false };
  const f = Number(raw);
  if (!Number.isFinite(f) || f <= 0 || f > 1) return { tw: twRaw, twRaw, floorApplied: false };
  const tw = Math.max(twRaw, f);
  return { tw, twRaw, floorApplied: tw > twRaw };
}

function trustCsvPath() {
  return path.join(repoRoot, "config/local/trust_cycle.csv");
}

function trustCsvExamplePath() {
  return path.join(repoRoot, "apps/agent/fixtures/trust_cycle.example.csv");
}

/** @returns {{ header: string[], rows: Record<string, string>[], src: string }} */
function readTrustCsv() {
  const local = trustCsvPath();
  if (fs.existsSync(local)) {
    return { ...parseCsvFile(local), src: local };
  }
  const { header } = parseCsvFile(trustCsvExamplePath());
  return { header, rows: [], src: trustCsvExamplePath() };
}

function parseCsvFile(p) {
  const lines = fs.readFileSync(p, "utf8").trim().split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map((s) => s.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const o = {};
    header.forEach((h, j) => {
      o[h] = parts[j]?.trim() ?? "";
    });
    rows.push(o);
  }
  return { header, rows };
}

function writeTrustCsv(header, rows) {
  const dest = trustCsvPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(header.map((h) => r[h] ?? "").join(","));
  }
  fs.writeFileSync(dest, lines.join("\n") + "\n");
  return dest;
}

/**
 * Remove rows for this cycle_id so re-run is idempotent.
 */
function upsertTrustRows(cycleIdStr, newRows) {
  const { header, rows } = readTrustCsv();
  const filtered = rows.filter((r) => String(r.cycle_id ?? "") !== String(cycleIdStr));
  const merged = [...filtered, ...newRows];
  const dest = writeTrustCsv(header, merged);
  return { dest, dropped: rows.length - filtered.length, header };
}

async function main() {
  ensureCycleClockReady();
  const clock = loadCycleClockState();
  const managed = computeManagedCycle();
  if (!clock || !managed) {
    console.error("Need valid cycle-clock and managed cycle (check config/agent/cycles.yaml).");
    process.exit(1);
  }

  const finalizeKey =
    process.env.TRUST_FINALIZE_CYCLE_KEY ??
    (managed.index > 0 ? String(managed.index - 1) : null);
  if (finalizeKey == null) {
    console.error("Set TRUST_FINALIZE_CYCLE_KEY (no previous window at index 0).");
    process.exit(1);
  }

  const cycleIndex = Number(finalizeKey);
  if (!Number.isFinite(cycleIndex) || cycleIndex < 0) {
    console.error(`Bad TRUST_FINALIZE_CYCLE_KEY: ${finalizeKey}`);
    process.exit(1);
  }

  const { cycleStartSec, cycleEndSec } = cycleWindowBounds(clock.genesisUnix, clock.durationSec, cycleIndex);
  const durationSec = clock.durationSec;

  const { store, path: storePath } = loadVoteStore();
  const cycle = getCycle(store, finalizeKey);

  const lastBy = lastBallotByVoter(cycle.ballots);
  const assets = new Set();
  for (const b of lastBy.values()) {
    for (const a of Object.keys(b.weights ?? {})) assets.add(a);
  }
  if (assets.size === 0) {
    console.error("No ballots for finalized cycle.");
    process.exit(1);
  }

  const { client, chainId } = makeChainClient();
  const yaml = loadChainYaml(chainId);
  const { prices: endPrices, errors: priceErrors } = await fetchUsdcPricesForTokens(client, yaml, [...assets]);

  const testBoostTrust = getTestBoostTrustMultiplier();

  const results = [];
  const newCsvRows = [];

  for (const [voter, ballot] of lastBy.entries()) {
    const startMarks = ballot.priceMarksUsdc;
    if (!startMarks || Object.keys(startMarks).length === 0) {
      results.push({ voter, skipped: true, reason: "missing_priceMarksUsdc_run_trust_stamp_prices" });
      continue;
    }

    const voteSec = voteUnixFromSubmittedAt(ballot.submittedAt, cycleStartSec);
    const twRaw = timeWeightRemainingInCycle(voteSec, cycleStartSec, cycleEndSec, durationSec);
    const { tw, floorApplied } = timeWeightWithOptionalFloor(twRaw);

    const portFull = portfolioReturnDecimal(ballot.weights, startMarks, endPrices);
    const effective = portFull * tw;

    if (twRaw < 1e-6 && Math.abs(portFull) > 1e-12 && !floorApplied) {
      console.warn(
        `[trust-finalize] ${voter}: time_weight≈0 (vote near cycle end) × portfolio return ${portFull} → effective 0. ` +
          `Trust bps stay 0. Fix: vote earlier, or set TRUST_MIN_TIME_WEIGHT_FLOOR=0.25 in .env (dev), or use TESTBOOSTTRUST only after effective≠0.`,
      );
    }

    const missing = [];
    for (const addr of Object.keys(ballot.weights ?? {})) {
      const k = addr.toLowerCase();
      const p0 = startMarks[k];
      const p1 = endPrices[k];
      if (p0 == null || p1 == null || !Number.isFinite(p0) || !Number.isFinite(p1) || p0 <= 0) missing.push(k);
    }
    if (missing.length > 0) {
      results.push({
        voter,
        skipped: true,
        reason: "missing_prices",
        missing,
      });
      continue;
    }

    /** Boost only affects rounded vote bps (dev). Benchmark stays unscaled for comparison in logs. */
    const voteBps = Math.round(effective * 10000 * testBoostTrust);
    const benchBps = Math.round(portFull * 10000);

    newCsvRows.push({
      cycle_id: String(finalizeKey),
      voter_address: voter,
      vote_return_bps: String(voteBps),
      benchmark_return_bps: String(benchBps),
    });

    if (voteBps === 0 && testBoostTrust === 1 && Math.abs(effective) > 1e-15) {
      console.warn(
        `[trust-finalize] ${voter}: effective return ${effective} rounded to 0 bps — trust will not move. ` +
          `Set TESTBOOSTTRUST in .env (dev) to amplify before rounding.`,
      );
    }

    results.push({
      voter,
      skipped: false,
      timeWeight: tw,
      timeWeightRaw: twRaw,
      timeWeightFloorApplied: floorApplied,
      portfolioReturnFull: portFull,
      effectiveReturn: effective,
      vote_return_bps: voteBps,
      benchmark_return_bps: benchBps,
    });
  }

  const { dest, dropped } = upsertTrustRows(finalizeKey, newCsvRows);

  console.log(
    JSON.stringify(
      {
        ok: true,
        finalizeCycleKey: finalizeKey,
        cycleWindow: {
          startIso: new Date(cycleStartSec * 1000).toISOString(),
          endIso: new Date(cycleEndSec * 1000).toISOString(),
        },
        voteStore: storePath,
        trustCsv: path.relative(repoRoot, dest),
        replacedPriorRows: dropped,
        priceErrors,
        testBoostTrust,
        voters: results,
        next: "Set config/trust/scoring.yaml update_rule: time_weighted_portfolio_return then: npm run trust && npm run trust:export",
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
