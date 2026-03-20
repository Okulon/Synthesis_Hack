/**
 * Aggregate allocation votes → normalized targets (cycle store or legacy votes.json).
 * Trust from trust_cycle CSV + scoring.yaml; power = trust × share (1e18) when snapshot present.
 */
import { aggregateBallots, aggregateVotes, resolveVoteAggregationInput } from "./lib/aggregateCore.mjs";
import { loadTrustByVoterMap, loadTrustDefaults } from "./lib/trustMap.mjs";

async function main() {
  const input = resolveVoteAggregationInput();
  const scoring = loadTrustDefaults();
  const trustByVoter = loadTrustByVoterMap();

  if (input.kind === "legacy") {
    const { targets, rawSum, trustMass, warnings } = aggregateVotes(input.voters);
    console.log(
      JSON.stringify(
        {
          source: input.src,
          kind: "legacy",
          cycleId: input.cycleId,
          voterCount: input.voters.length,
          aggregationMode: "trust_only_legacy",
          targets,
          rawSum,
          trustMass,
          warnings,
        },
        null,
        2
      )
    );
  } else {
    const strict = process.env.AGGREGATE_STRICT_SHARES === "1";
    const { targets, rawSum, trustMass, voters, warnings, aggregationMode } = aggregateBallots(
      input.cycle.ballots,
      trustByVoter,
      input.cycle.shares1e18,
      { requireShares: strict, defaultTrust: scoring.defaultTrust }
    );
    console.log(
      JSON.stringify(
        {
          source: input.src,
          kind: "vote-store",
          cycleKey: input.cycleKey,
          onChainCycleId: input.cycle.onChainCycleId,
          votingOpen: input.cycle.votingOpen,
          snapshotBlock: input.cycle.snapshotBlock,
          voterCount: input.cycle.ballots.length,
          uniqueVoters: voters.length,
          aggregationMode,
          targets,
          rawSum,
          trustMass,
          warnings,
          voters,
          managedWindow: input.managed ?? null,
        },
        null,
        2
      )
    );
  }
  console.error(
    "\nTip: copy `targets` into config/local/targets.json for `npm run plan`; set `onChainCycleId` on targets JSON if you track it."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
