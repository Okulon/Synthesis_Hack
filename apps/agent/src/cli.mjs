/**
 * Dry-run: current vault weights vs local targets + band policy (no txs).
 */
import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";

import { repoRoot } from "./lib/env.mjs";
import { loadBands, loadTargets, fetchPlanRows } from "./lib/planState.mjs";

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
  const rpcUrl = process.env.CHAIN_RPC_URL;
  const vaultAddr = process.env.VAULT_ADDRESS;
  const chainId = Number(process.env.CHAIN_ID ?? "84532");

  if (!rpcUrl || !vaultAddr) {
    console.error("Set CHAIN_RPC_URL and VAULT_ADDRESS in .env (repo root).");
    process.exit(1);
  }

  const bands = loadBands();
  if (bands.driftMetric !== "absolute_pp") {
    console.warn(`Warning: drift_metric=${bands.driftMetric} — only absolute_pp is implemented.`);
  }

  const { cycleId, source, targets } = loadTargets();
  /** stderr only — stdout must be a single JSON object (agent parses it for rebalance loop). */
  console.error(`[plan] targets: ${source} (cycleId=${cycleId})`);

  const { chain, transport } = pickChain(rpcUrl, chainId);
  const client = createPublicClient({ chain, transport });

  const { totalNAV, rows } = await fetchPlanRows(client, vaultAddr, bands, targets);

  console.log(JSON.stringify({ chainId, vault: vaultAddr, totalNAV: totalNAV.toString(), bands, rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
