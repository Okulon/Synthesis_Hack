/**
 * Merge on-chain AllocationBallotCast events into vote-store for a wall-clock cycle key.
 * Trust finalize + aggregate read vote-store; they do not see chain-only ballots without this.
 *
 * Preserves existing `priceMarksUsdc` / `priceMarksCapturedAt` per voter when the vote-store
 * already had them (e.g. stamped during voting). Replacing ballots blindly would drop marks so
 * stamp-prices would refill at close time = same as finalize end price → 0 portfolio return.
 *
 * Env: CHAIN_RPC_URL, VAULT_ADDRESS, CHAIN_ID (optional)
 * SYNC_VOTE_CYCLE_KEY — vote-store cycle key (e.g. "9"). Default: vote-store defaultCycleKey.
 * ALLOCATION_VOTE_LOGS_FROM_BLOCK — optional; default: last 100k blocks from head.
 */
import { getAddress, parseAbi } from "viem";

import { makeChainClient } from "./lib/assetPrices.mjs";
import "./lib/env.mjs";
import { readAllocationBallotsForCycleWithWeights } from "./lib/quorumChain.mjs";
import { getCycle, loadVoteStore, normalizeVoteStore, saveVoteStore } from "./lib/voteStore.mjs";

const DEFAULT_LOOKBACK = 100_000n;

const ballotAbi = parseAbi([
  "function ballotAssetsLength() view returns (uint256)",
  "function ballotAssets(uint256) view returns (address)",
]);

function parseBlockEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === "") return undefined;
  try {
    return BigInt(v);
  } catch {
    return undefined;
  }
}

async function fetchBallotAssetAddresses(client, vault) {
  const n = await client.readContract({
    address: vault,
    abi: ballotAbi,
    functionName: "ballotAssetsLength",
  });
  const len = Number(n);
  if (!Number.isFinite(len) || len <= 0) {
    throw new Error("ballotAssetsLength is 0 — cannot map on-chain weights");
  }
  const out = [];
  for (let i = 0; i < len; i += 1) {
    const a = await client.readContract({
      address: vault,
      abi: ballotAbi,
      functionName: "ballotAssets",
      args: [BigInt(i)],
    });
    out.push(getAddress(a));
  }
  return out;
}

async function main() {
  const rpc = process.env.CHAIN_RPC_URL;
  const vaultRaw = process.env.VAULT_ADDRESS;
  if (!rpc || !vaultRaw) {
    console.error(JSON.stringify({ ok: false, reason: "CHAIN_RPC_URL and VAULT_ADDRESS required" }));
    process.exit(1);
  }
  const vault = /** @type {`0x${string}`} */ (vaultRaw);

  const { store, path: storePath } = loadVoteStore();
  const cycleKey = process.env.SYNC_VOTE_CYCLE_KEY ?? store.defaultCycleKey;
  const cycle = getCycle(store, cycleKey);

  const onChainCycleId = BigInt(cycle.onChainCycleId ?? 0);

  const { client } = makeChainClient();
  const head = await client.getBlockNumber();
  const fromBlock =
    parseBlockEnv("ALLOCATION_VOTE_LOGS_FROM_BLOCK") ??
    parseBlockEnv("VITE_ALLOCATION_VOTE_LOGS_FROM_BLOCK") ??
    (head >= DEFAULT_LOOKBACK ? head - DEFAULT_LOOKBACK : 0n);

  const assetAddrs = await fetchBallotAssetAddresses(client, vault);
  const rows = await readAllocationBallotsForCycleWithWeights(client, vault, fromBlock, head, onChainCycleId);

  /** @type {Map<string, { priceMarksUsdc?: Record<string, number> | null; priceMarksCapturedAt?: string | null }>} */
  const priorMarksByVoter = new Map();
  for (const b of cycle.ballots ?? []) {
    const v = (b.voter ?? "").toLowerCase();
    if (!v) continue;
    const m = b.priceMarksUsdc;
    if (m && typeof m === "object" && Object.keys(m).length > 0) {
      priorMarksByVoter.set(v, {
        priceMarksUsdc: { ...m },
        priceMarksCapturedAt: b.priceMarksCapturedAt ?? null,
      });
    }
  }

  const ballots = [];
  const skipped = [];
  let preservedPriceMarks = 0;

  for (const row of rows) {
    if (row.weightsBps.length !== assetAddrs.length) {
      skipped.push({
        voter: row.voter,
        reason: `weights length ${row.weightsBps.length} !== ballotAssets ${assetAddrs.length}`,
      });
      continue;
    }
    const weights = {};
    for (let i = 0; i < assetAddrs.length; i += 1) {
      weights[assetAddrs[i].toLowerCase()] = row.weightsBps[i] / 10_000;
    }
    const block = await client.getBlock({ blockNumber: row.blockNumber });
    const ts = block.timestamp ? Number(block.timestamp) * 1000 : Date.now();
    const voter = row.voter.toLowerCase();
    /** @type {{ voter: string; weights: Record<string, number>; submittedAt: string; priceMarksUsdc?: Record<string, number>; priceMarksCapturedAt?: string | null }} */
    const ballot = {
      voter,
      weights,
      submittedAt: new Date(ts).toISOString(),
    };
    const prior = priorMarksByVoter.get(voter);
    if (prior?.priceMarksUsdc) {
      ballot.priceMarksUsdc = prior.priceMarksUsdc;
      if (prior.priceMarksCapturedAt) ballot.priceMarksCapturedAt = prior.priceMarksCapturedAt;
      preservedPriceMarks += 1;
    }

    ballots.push(ballot);
  }

  cycle.ballots = ballots;
  store.cycles[cycleKey] = cycle;
  const written = saveVoteStore(normalizeVoteStore(store));

  console.log(
    JSON.stringify(
      {
        ok: true,
        voteStore: storePath,
        written,
        cycleKey,
        onChainCycleId: onChainCycleId.toString(),
        logScan: { fromBlock: fromBlock.toString(), toBlock: head.toString() },
        ballotCount: ballots.length,
        preservedPriceMarks,
        skipped,
        next: "Run: VOTE_CYCLE_KEY=<cycle> npm run trust:stamp-prices (or agent does this before trust-finalize)",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
