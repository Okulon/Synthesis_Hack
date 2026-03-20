/**
 * Writes frontend/public/allocation-votes.json from vote-store or legacy votes.json.
 * Run: cd apps/agent && npm run votes:export
 */
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";

import { aggregateBallots, aggregateVotes, resolveVoteAggregationInput } from "./lib/aggregateCore.mjs";
import { getManagedClockExportPayload } from "./lib/cycleClock.mjs";
import { repoRoot } from "./lib/env.mjs";
import { loadTrustByVoterMap, loadTrustDefaults } from "./lib/trustMap.mjs";

function dedupeBallots(ballots) {
  const map = new Map();
  for (const b of ballots) {
    if (!b.voter) continue;
    map.set(b.voter.toLowerCase(), b);
  }
  return [...map.values()];
}

const input = resolveVoteAggregationInput();
const scoring = loadTrustDefaults();
const trustByVoter = loadTrustByVoterMap();
const managedClock = getManagedClockExportPayload();

function buildMeta(extra) {
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

const governance = loadGovernanceForExport();

let out;

if (input.kind === "legacy") {
  const r = aggregateVotes(input.voters);
  out = {
    kind: "legacy",
    cycleId: input.cycleId,
    onChainCycleId: input.cycleId,
    cycleKey: null,
    activeVoteCycleKey: null,
    managedWindowIndex: null,
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
    _meta: buildMeta({ rawSum: r.rawSum, trustMass: r.trustMass }),
  };
} else {
  const r = aggregateBallots(input.cycle.ballots, trustByVoter, input.cycle.shares1e18, {
    requireShares: false,
    defaultTrust: scoring.defaultTrust,
  });
  const byVoter = Object.fromEntries(r.voters.map((x) => [x.voter, x]));
  const ballots = dedupeBallots(input.cycle.ballots);
  out = {
    kind: "vote-store",
    cycleId: input.cycle.onChainCycleId,
    onChainCycleId: input.cycle.onChainCycleId,
    cycleKey: input.cycleKey,
    activeVoteCycleKey: input.cycleKey,
    managedWindowIndex: input.managed?.index ?? null,
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
    _meta: buildMeta({
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
  `Wrote ${path.relative(repoRoot, dest)} (${out.voterCount} ballots, ${Object.keys(out.targets).length} assets, mode=${out.aggregationMode})`
);
