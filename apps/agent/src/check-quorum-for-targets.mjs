/**
 * Gates **only** whether the agent may write **`config/local/targets.json`** (used by `plan` / rebalance).
 * Does **not** apply to **`allocation-votes.json`** / dashboard aggregate display.
 *
 * Exit code: 0 = quorum met (or gate skipped), 2 = below quorum, 1 = error.
 * Stdout: one JSON line with stats (for logs).
 *
 * Env: CHAIN_RPC_URL, VAULT_ADDRESS, CHAIN_ID; optional HOLDER_LOGS_FROM_BLOCK, ALLOCATION_VOTE_LOGS_FROM_BLOCK
 */
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";

import "./lib/env.mjs";
import { resolveVoteAggregationInput } from "./lib/aggregateCore.mjs";
import { repoRoot } from "./lib/env.mjs";
import { computeAllocQuorumStats } from "./lib/quorumAlloc.mjs";
import { fetchHoldersAndBallotVoters, makeQuorumPublicClient } from "./lib/quorumChain.mjs";
import { loadTrustByVoterMap } from "./lib/trustMap.mjs";
import { loadScoring } from "./lib/trustCore.mjs";

function loadQuorumFraction() {
  const p = path.join(repoRoot, "config/governance/defaults.yaml");
  const doc = parseYaml(fs.readFileSync(p, "utf8"));
  return Number(doc.governance?.quorum_fraction ?? 0.15);
}

function parseBlockEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === "") return undefined;
  try {
    return BigInt(v);
  } catch {
    return undefined;
  }
}

async function main() {
  const input = resolveVoteAggregationInput();

  if (input.kind === "legacy") {
    const line = JSON.stringify({
      quorumMet: true,
      gate: "skipped",
      reason: "legacy votes.json — quorum gate applies to vote-store only",
    });
    console.log(line);
    process.exit(0);
  }

  const rpc = process.env.CHAIN_RPC_URL;
  const vaultRaw = process.env.VAULT_ADDRESS;
  if (!rpc || !vaultRaw) {
    console.error(
      JSON.stringify({ ok: false, reason: "CHAIN_RPC_URL and VAULT_ADDRESS required for quorum check" }),
    );
    process.exit(1);
  }

  const vault = /** @type {`0x${string}`} */ (vaultRaw);
  const chainId = Number(process.env.CHAIN_ID ?? "84532");
  const cycleId = BigInt(input.cycle.onChainCycleId ?? 0);

  const client = makeQuorumPublicClient(rpc, chainId);
  const holderFrom = parseBlockEnv("HOLDER_LOGS_FROM_BLOCK") ?? parseBlockEnv("VITE_HOLDER_LOGS_FROM_BLOCK");
  const allocationFrom =
    parseBlockEnv("ALLOCATION_VOTE_LOGS_FROM_BLOCK") ?? parseBlockEnv("VITE_ALLOCATION_VOTE_LOGS_FROM_BLOCK");

  const { holders, ballotVoters } = await fetchHoldersAndBallotVoters(client, vault, cycleId, {
    holderFromBlock: holderFrom,
    allocationFromBlock: allocationFrom,
  });

  const trustByVoter = loadTrustByVoterMap();
  const { defaultTrust } = loadScoring();
  const quorumFraction = loadQuorumFraction();
  const votedSet = new Set(ballotVoters.map((a) => a.toLowerCase()));

  const stats = computeAllocQuorumStats(holders, trustByVoter, defaultTrust, quorumFraction, votedSet);

  const payload = {
    ok: true,
    onChainCycleId: cycleId.toString(),
    ...stats,
  };
  console.log(JSON.stringify(payload));

  process.exit(stats.quorumMet ? 0 : 2);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, reason: String(e?.message ?? e) }));
  process.exit(1);
});
