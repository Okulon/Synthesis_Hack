/**
 * Record share balances at a block for all ballot voters (vote-store cycle).
 * Writes config/local/vote-store.json (create from fixture first).
 *
 * Env: CHAIN_RPC_URL, VAULT_ADDRESS, VOTE_CYCLE_KEY (optional), CYCLE_SNAPSHOT_BLOCK (optional, default latest),
 *      CYCLE_KEEP_VOTING_OPEN=1 to leave votingOpen true after snapshot (default: set false).
 */
import { createPublicClient, http, parseAbi } from "viem";
import { base, baseSepolia } from "viem/chains";

import { getCycle, loadVoteStore, normalizeVoteStore, saveVoteStore } from "./lib/voteStore.mjs";
import { requireEnv, repoRoot } from "./lib/env.mjs";
import fs from "fs";
import path from "path";

const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

function pickChain(rpcUrl, chainId) {
  if (chainId === 8453) return { chain: base, transport: http(rpcUrl) };
  if (chainId === 84532) return { chain: baseSepolia, transport: http(rpcUrl) };
  return {
    chain: {
      id: chainId,
      name: "custom",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl),
  };
}

async function main() {
  const fixedLocal = path.join(repoRoot, "config/local/vote-store.json");
  if (!fs.existsSync(fixedLocal)) {
    console.error(
      "Missing config/local/vote-store.json — copy apps/agent/fixtures/vote-store.example.json there and edit ballots, or run from a repo that already has a local store."
    );
    process.exit(1);
  }

  const rpcUrl = requireEnv("CHAIN_RPC_URL");
  const vaultAddr = requireEnv("VAULT_ADDRESS");
  const chainId = Number(process.env.CHAIN_ID ?? "84532");
  const { chain, transport } = pickChain(rpcUrl, chainId);
  const client = createPublicClient({ chain, transport });

  const { store: rawStore } = loadVoteStore();
  const store = structuredClone(rawStore);
  const cycleKey = process.env.VOTE_CYCLE_KEY || store.defaultCycleKey;
  const cycle = getCycle(store, cycleKey);

  const blockOpt = process.env.CYCLE_SNAPSHOT_BLOCK;
  const blockNumber = blockOpt ? BigInt(blockOpt) : await client.getBlockNumber();

  const voters = [...new Set(cycle.ballots.map((b) => b.voter).filter(Boolean))];
  if (voters.length === 0) {
    console.error("No voters in ballots for this cycle.");
    process.exit(1);
  }

  const shares1e18 = { ...cycle.shares1e18 };
  for (const v of voters) {
    const bal = await client.readContract({
      address: vaultAddr,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [v],
      blockNumber,
    });
    shares1e18[v.toLowerCase()] = bal.toString();
  }

  cycle.snapshotBlock = blockNumber.toString();
  cycle.snapshotCapturedAt = new Date().toISOString();
  cycle.shares1e18 = shares1e18;
  if (process.env.CYCLE_KEEP_VOTING_OPEN !== "1") {
    cycle.votingOpen = false;
  }

  store.cycles[cycleKey] = cycle;
  const written = saveVoteStore(normalizeVoteStore(store));
  console.log(
    JSON.stringify(
      {
        ok: true,
        written,
        cycleKey,
        snapshotBlock: cycle.snapshotBlock,
        voterCount: voters.length,
        shares1e18: cycle.shares1e18,
        votingOpen: cycle.votingOpen,
      },
      (_, x) => (typeof x === "bigint" ? x.toString() : x),
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
