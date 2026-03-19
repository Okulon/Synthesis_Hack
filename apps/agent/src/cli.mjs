/**
 * Dry-run: current vault weights vs local targets + band policy (no txs).
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import { createPublicClient, http, parseAbi } from "viem";
import { base, baseSepolia } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/agent/src -> repo root
const repoRoot = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(repoRoot, ".env") });

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

function loadBands() {
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

function loadTargets() {
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

function valueOf1e18(balance, price1e18, decimals) {
  return (balance * price1e18) / 10n ** BigInt(decimals);
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
  console.log(`Targets: ${source} (cycleId=${cycleId})`);

  const { chain, transport } = pickChain(rpcUrl, chainId);
  const client = createPublicClient({ chain, transport });

  const vault = vaultAddr;

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
    const wTgt = targets[key] ?? 0;
    const driftPp = Math.abs(wCur - wTgt) * 100;
    const eps =
      bands.perAssetEpsilonPp[sym] ?? bands.perAssetEpsilonPp[asset] ?? bands.globalEpsilonPp;
    const notionalRough = (driftPp / 100) * (Number(totalNAV) / 1e18);
    const overEps = driftPp >= eps - 1e-9;
    const overMin = notionalRough >= bands.minTradeNotionalQuote - 1e-9;
    const wouldTrade = overEps && overMin;

    rows.push({
      symbol: sym,
      asset,
      wCur,
      wTgt,
      driftPp,
      epsilonPp: eps,
      notionalRough,
      minNotional: bands.minTradeNotionalQuote,
      decision: wouldTrade ? "would_trade" : "skip",
      skipReason: !overEps ? "within_epsilon" : !overMin ? "below_min_notional" : null,
    });
  }

  console.log(JSON.stringify({ chainId, vault, totalNAV: totalNAV.toString(), bands, rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
