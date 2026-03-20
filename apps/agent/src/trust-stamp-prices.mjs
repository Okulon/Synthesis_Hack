/**
 * Fill ballot.priceMarksUsdc from live Uniswap v3 mid (USDC per token) for each asset in weights.
 * Run when a vote is submitted / before cycle end. Needs CHAIN_RPC_URL (+ optional CHAIN_ID).
 *
 * Optional: VOTE_CYCLE_KEY (default: vote-store defaultCycleKey)
 * TRUST_STAMP_OVERWRITE=1 — replace existing marks for weighted assets
 */
import path from "path";

import { fetchUsdcPricesForTokens, loadChainYaml, makeChainClient } from "./lib/assetPrices.mjs";
import { repoRoot } from "./lib/env.mjs";
import { getCycle, loadVoteStore, normalizeVoteStore, saveVoteStore } from "./lib/voteStore.mjs";

async function main() {
  const { store, path: src } = loadVoteStore();
  const key = process.env.VOTE_CYCLE_KEY ?? store.defaultCycleKey;
  const cycle = getCycle(store, key);

  const assets = [];
  for (const b of cycle.ballots) {
    for (const a of Object.keys(b.weights ?? {})) {
      assets.push(a);
    }
  }
  if (assets.length === 0) {
    console.log(JSON.stringify({ ok: true, note: "no ballots / weights", cycleKey: key }, null, 2));
    return;
  }

  const { client, chainId } = makeChainClient();
  const yaml = loadChainYaml(chainId);
  const { prices, errors } = await fetchUsdcPricesForTokens(client, yaml, assets);

  const overwrite = process.env.TRUST_STAMP_OVERWRITE === "1";
  let touched = 0;
  const stampIso = new Date().toISOString();

  for (const b of cycle.ballots) {
    const marks = { ...(b.priceMarksUsdc ?? {}) };
    let changed = false;
    for (const addr of Object.keys(b.weights ?? {})) {
      const k = addr.toLowerCase();
      if (!overwrite && marks[k] != null && Number.isFinite(marks[k])) continue;
      const p = prices[k];
      if (p == null || !Number.isFinite(p)) continue;
      marks[k] = p;
      changed = true;
    }
    if (changed) {
      b.priceMarksUsdc = marks;
      b.priceMarksCapturedAt = stampIso;
      touched += 1;
    }
  }

  store.cycles[key] = cycle;
  const written = saveVoteStore(normalizeVoteStore(store));

  console.log(
    JSON.stringify(
      {
        ok: true,
        voteStore: src,
        written: path.relative(repoRoot, written),
        cycleKey: key,
        ballotsUpdated: touched,
        priceErrors: errors,
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
