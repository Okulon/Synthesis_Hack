/**
 * Shared vault snapshot + band rows for `plan` (cli) and `rebalance` (target sizing).
 */
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { parseAbi } from "viem";

import { repoRoot } from "./env.mjs";
import { computeAssetBandDecision } from "./bandPolicy.mjs";

const vaultAbi = parseAbi([
  "function totalNAV() view returns (uint256)",
  "function trackedAssetsLength() view returns (uint256)",
  "function trackedAssets(uint256) view returns (address)",
  "function pricePerFullToken1e18(address) view returns (uint256)",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

export function valueOf1e18(balance, price1e18, decimals) {
  return (balance * price1e18) / 10n ** BigInt(decimals);
}

export function loadBands() {
  const p = path.join(repoRoot, "config/rebalancing/bands.yaml");
  const raw = fs.readFileSync(p, "utf8");
  const doc = parseYaml(raw);
  const r = doc.rebalancing;
  if (!r) throw new Error("config/rebalancing/bands.yaml: missing rebalancing key");
  return {
    driftMetric: r.drift_metric ?? "absolute_pp",
    globalEpsilonPp: Number(r.global_epsilon_pp ?? 2),
    perAssetEpsilonPp: r.per_asset_epsilon_pp ?? {},
    minTradeNotionalQuote: Number(r.min_trade_notional_quote ?? 0),
  };
}

export function loadTargets() {
  const local = path.join(repoRoot, "config/local/targets.json");
  const example = path.join(repoRoot, "apps/agent/fixtures/targets.example.json");
  const src = fs.existsSync(local) ? local : example;
  const raw = fs.readFileSync(src, "utf8");
  const j = JSON.parse(raw);
  const targets = j.targets ?? {};
  const norm = {};
  let sum = 0;
  for (const [k, v] of Object.entries(targets)) {
    norm[k.toLowerCase()] = Number(v);
    sum += Number(v);
  }
  if (sum <= 0) throw new Error("targets must sum to > 0 (after parsing)");
  for (const k of Object.keys(norm)) {
    norm[k] /= sum;
  }
  return { cycleId: j.cycleId ?? 0, source: src, targets: norm };
}

/**
 * @param {import("viem").PublicClient} client
 * @param {`0x${string}`} vault
 * @param {ReturnType<typeof loadBands>} bands
 * @param {Record<string, number>} targetsNorm
 */
export async function fetchPlanRows(client, vault, bands, targetsNorm) {
  const totalNAV = await client.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "totalNAV",
  });

  const n = await client.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "trackedAssetsLength",
  });

  const rows = [];
  for (let i = 0n; i < n; i++) {
    const asset = await client.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: "trackedAssets",
      args: [i],
    });
    const price = await client.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: "pricePerFullToken1e18",
      args: [asset],
    });
    const [bal, dec, sym] = await Promise.all([
      client.readContract({
        address: asset,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [vault],
      }),
      client.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address: asset, abi: erc20Abi, functionName: "symbol" }),
    ]);

    const value = valueOf1e18(bal, price, dec);
    const wCur = totalNAV === 0n ? 0 : Number(value) / Number(totalNAV);
    const key = asset.toLowerCase();
    const wTgt = targetsNorm[key] ?? 0;

    const d = computeAssetBandDecision({
      wCur,
      wTgt,
      globalEpsilonPp: bands.globalEpsilonPp,
      perAssetEpsilonPp: bands.perAssetEpsilonPp,
      symbol: sym,
      asset,
      totalNAV1e18: totalNAV,
      minTradeNotionalQuote: bands.minTradeNotionalQuote,
    });

    rows.push({
      symbol: sym,
      asset,
      wCur,
      wTgt,
      driftPp: d.driftPp,
      epsilonPp: d.epsilonPp,
      notionalRough: d.notionalRough,
      minNotional: bands.minTradeNotionalQuote,
      decision: d.decision,
      skipReason: d.skipReason,
    });
  }

  return { totalNAV, rows };
}
