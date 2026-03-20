/**
 * Writes frontend/public/allocation-votes.json from vote-store or legacy votes.json.
 * Run: cd apps/agent && npm run votes:export
 *
 * Always runs cycle:sync first so vote-store defaultCycleKey matches the live wall-clock window.
 *
 * **Display vs execution:** The `targets` field here is the **full** trust×share aggregate of current
 * ballots (what the dashboard should show as “voted blend”). It is **not** gated by allocation quorum.
 * **`config/local/targets.json`** (written by the agent after `check-quorum-for-targets`) is the **only**
 * file `plan` / rebalance use — that path **is** quorum-gated so execution does not move until enough
 * participation is met.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

import { aggregateBallots, aggregateVotes, resolveVoteAggregationInput } from "./lib/aggregateCore.mjs";
import { computeManagedCycle, ensureCycleClockReady, getManagedClockExportPayload } from "./lib/cycleClock.mjs";
import { repoRoot } from "./lib/env.mjs";
import { loadTrustByVoterMap, loadTrustDefaults } from "./lib/trustMap.mjs";

const agentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runCycleSyncOnce() {
  const r = spawnSync(process.execPath, [path.join(agentRoot, "src/cycle-sync.mjs")], {
    cwd: agentRoot,
    env: process.env,
    stdio: "inherit",
  });
  return r.status === 0;
}

function dedupeBallots(ballots) {
  const map = new Map();
  for (const b of ballots) {
    if (!b.voter) continue;
    map.set(b.voter.toLowerCase(), b);
  }
  return [...map.values()];
}

function buildMeta(input, extra) {
  return {
    votesSource: path.relative(repoRoot, input.src).replace(/\\/g, "/"),
    updatedAt: new Date().toISOString(),
    note: "Regenerate: npm run votes:export (apps/agent). See docs/CYCLES_AND_VOTING.md.",
    ...extra,
  };
}

function loadGovernanceForExport() {
  const p = path.join(repoRoot, "config/governance/defaults.yaml");
  const doc = parseYaml(fs.readFileSync(p, "utf8"));
  const g = doc.governance ?? {};
  return {
    quorumFraction: Number(g.quorum_fraction ?? 0.15),
    approvalThresholdFraction: Number(g.approval_threshold_fraction ?? 0.5),
  };
}

function main() {
  /** Agent already runs `cycle:sync` immediately before this; skip duplicate work. */
  if (process.env.AGENT_SKIP_VOTES_EXPORT_SYNC !== "1") {
    if (!runCycleSyncOnce()) {
      console.error("[votes-export] cycle:sync failed — aborting export");
      process.exit(1);
    }
  }

  ensureCycleClockReady();

  const input = resolveVoteAggregationInput();
  const scoring = loadTrustDefaults();
  const trustByVoter = loadTrustByVoterMap();
  const managedClock = getManagedClockExportPayload();
  const liveManaged = computeManagedCycle();
  const liveKeyStr = liveManaged != null ? String(liveManaged.index) : null;

  const governance = loadGovernanceForExport();

  let out;

  if (input.kind === "legacy") {
    const r = aggregateVotes(input.voters);
    out = {
      kind: "legacy",
      cycleId: input.cycleId,
      onChainCycleId: input.cycleId,
      cycleKey: null,
      activeVoteCycleKey: liveKeyStr,
      managedWindowIndex: liveManaged?.index ?? null,
      voterCount: input.voters.length,
      uniqueVoters: input.voters.length,
      votingOpen: null,
      snapshotBlock: null,
      snapshotCapturedAt: null,
      aggregationMode: r.aggregationMode ?? "trust_only_legacy",
      warnings: r.warnings ?? [],
      voters: input.voters.map((v) => ({
        address: (v.address ?? "").toLowerCase(),
        trust: Number(v.trust ?? 1),
        weights: v.weights ?? {},
        share1e18: null,
        votingPower: Number(v.trust ?? 1),
        submittedAt: null,
      })),
      targets: r.targets,
      managedClock,
      governance,
      _meta: buildMeta(input, { rawSum: r.rawSum, trustMass: r.trustMass }),
    };
  } else {
    const r = aggregateBallots(input.cycle.ballots, trustByVoter, input.cycle.shares1e18, {
      requireShares: false,
      defaultTrust: scoring.defaultTrust,
    });
    const ballots = dedupeBallots(input.cycle.ballots);
    const byVoter = Object.fromEntries(r.voters.map((x) => [x.voter, x]));
    out = {
      kind: "vote-store",
      cycleId: input.cycle.onChainCycleId,
      onChainCycleId: input.cycle.onChainCycleId,
      /** Vote-store cycle used for aggregation (ballots / targets source). */
      cycleKey: input.cycleKey,
      /** Live wall-clock window index (matches managedClock.live.index when clock is valid). */
      activeVoteCycleKey: liveKeyStr ?? input.cycleKey,
      managedWindowIndex: liveManaged?.index ?? input.managed?.index ?? null,
      voterCount: input.cycle.ballots.length,
      uniqueVoters: r.voters.length,
      votingOpen: input.cycle.votingOpen,
      snapshotBlock: input.cycle.snapshotBlock,
      snapshotCapturedAt: input.cycle.snapshotCapturedAt,
      aggregationMode: r.aggregationMode,
      warnings: r.warnings,
      voters: ballots.map((b) => {
        const row = byVoter[b.voter];
        return {
          address: b.voter,
          trust: row?.trust ?? scoring.defaultTrust,
          weights: b.weights,
          share1e18: row?.share1e18 ?? null,
          votingPower: row?.votingPower ?? row?.trust ?? scoring.defaultTrust,
          submittedAt: b.submittedAt,
        };
      }),
      targets: r.targets,
      managedClock,
      governance,
      _meta: buildMeta(input, {
        rawSum: r.rawSum,
        trustMass: r.trustMass,
        cycleLabel: input.cycle.label,
      }),
    };
  }

  const dest = path.join(repoRoot, "frontend/public/allocation-votes.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(
    `Wrote ${path.relative(repoRoot, dest)} (${out.voterCount} ballots, ${Object.keys(out.targets).length} assets, mode=${out.aggregationMode})`,
  );
}

main();
