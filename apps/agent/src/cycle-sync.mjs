/**
 * Align config/local/vote-store.json with the current managed wall-clock window:
 * Ensures cycles[<index>] exists, seeds ballots from previous window (or prior default), sets defaultCycleKey,
 * toggles votingOpen from phase (voting vs frozen). Optional: sync onChainCycleId from VAULT_ADDRESS.
 *
 * Auto-initializes wall-clock if needed (same as `cycle:clock-init`). Copies fixture vote-store if no local file.
 */
import fs from "fs";
import path from "path";
import { createPublicClient, http, parseAbi } from "viem";
import { base, baseSepolia } from "viem/chains";

import { computeManagedCycle, ensureCycleClockReady } from "./lib/cycleClock.mjs";
import { repoRoot } from "./lib/env.mjs";
import {
  normalizeVoteStore,
  saveVoteStore,
  voteStoreExamplePath,
  voteStoreLocalPath,
} from "./lib/voteStore.mjs";

const daovaultAbi = parseAbi(["function cycleId() view returns (uint256)"]);

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

function cloneBallots(ballots) {
  return JSON.parse(JSON.stringify(ballots ?? []));
}

async function tryVaultCycleId() {
  const addr = process.env.VAULT_ADDRESS;
  const rpc = process.env.CHAIN_RPC_URL;
  if (!addr || !rpc) return null;
  const chainId = Number(process.env.CHAIN_ID ?? "84532");
  try {
    const { chain, transport } = pickChain(rpc, chainId);
    const client = createPublicClient({ chain, transport });
    const id = await client.readContract({
      address: addr,
      abi: daovaultAbi,
      functionName: "cycleId",
    });
    return Number(id);
  } catch {
    return null;
  }
}

async function main() {
  ensureCycleClockReady();
  const managed = computeManagedCycle();
  if (!managed || managed.phase === "before_genesis") {
    console.error("Managed clock still not ready after repair — check config/agent/cycles.yaml");
    process.exit(1);
  }

  const local = voteStoreLocalPath();
  if (!fs.existsSync(local)) {
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.copyFileSync(voteStoreExamplePath(), local);
    console.error("Created config/local/vote-store.json from fixture — review ballots.");
  }

  const raw = JSON.parse(fs.readFileSync(local, "utf8"));
  const store = normalizeVoteStore(raw);

  const key = String(managed.index);
  let entry = store.cycles[key];

  const onChain = await tryVaultCycleId();

  if (!entry) {
    let prev = store.cycles[String(managed.index - 1)];
    if (!prev?.ballots?.length) prev = store.cycles[store.defaultCycleKey];
    const seedBallots = prev?.ballots?.length ? cloneBallots(prev.ballots) : [];

    entry = {
      label: `Window ${key} · ${managed.calendarCycleStartIso}`,
      onChainCycleId: onChain ?? Number(key),
      votingOpen: managed.phase === "voting",
      snapshotBlock: null,
      snapshotCapturedAt: null,
      shares1e18: {},
      ballots: seedBallots,
    };
    store.cycles[key] = entry;
  } else {
    entry.votingOpen = managed.phase === "voting";
    if (onChain != null) entry.onChainCycleId = onChain;
    if (!entry.label) entry.label = `Window ${key}`;
  }

  store.defaultCycleKey = key;

  const written = saveVoteStore(normalizeVoteStore(store));
  console.log(
    JSON.stringify(
      {
        ok: true,
        written: path.relative(repoRoot, written),
        managedWindowIndex: managed.index,
        phase: managed.phase,
        defaultCycleKey: key,
        onChainCycleIdInStore: entry.onChainCycleId,
        vaultCycleId: onChain,
        ballotCount: entry.ballots.length,
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
