/**
 * Read Uniswap V3 pool state (factory → getPool → slot0 + liquidity) — no Quoter revert decoding.
 * Uses addresses from config/chain/base_sepolia.yaml (or override CHAIN_ID + YAML path later).
 */
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { createPublicClient, http, parseAbi } from "viem";
import { base, baseSepolia } from "viem/chains";

import { repoRoot, requireEnv } from "./lib/env.mjs";

const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);
const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint8,bool unlocked)",
  "function liquidity() view returns (uint128)",
]);

function sortTokens(a, b) {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
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

async function main() {
  const rpcUrl = requireEnv("CHAIN_RPC_URL");
  const chainId = Number(process.env.CHAIN_ID ?? "84532");
  const fee = Number(process.env.POOL_FEE ?? "3000");

  const yamlPath =
    chainId === 8453
      ? path.join(repoRoot, "config/chain/base.yaml")
      : path.join(repoRoot, "config/chain/base_sepolia.yaml");
  const raw = fs.readFileSync(yamlPath, "utf8");
  const doc = parseYaml(raw);
  const factory = doc.uniswap?.v3_factory;
  const usdc = doc.tokens?.USDC?.address;
  const weth = doc.tokens?.WETH?.address;
  if (!factory || !usdc || !weth) throw new Error("base_sepolia.yaml: need uniswap.v3_factory + tokens");

  const [t0, t1] = sortTokens(usdc, weth);
  const { chain, transport } = pickChain(rpcUrl, chainId);
  const client = createPublicClient({ chain, transport });

  const pool = await client.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "getPool",
    args: [t0, t1, fee],
  });

  if (pool === "0x0000000000000000000000000000000000000000") {
    console.log(JSON.stringify({ error: "no pool for fee tier", fee, t0, t1 }, null, 2));
    process.exit(1);
  }

  const [sqrtPriceX96, tick] = await client.readContract({
    address: pool,
    abi: poolAbi,
    functionName: "slot0",
  });
  const liq = await client.readContract({
    address: pool,
    abi: poolAbi,
    functionName: "liquidity",
  });

  console.log(
    JSON.stringify(
      {
        chainId,
        factory,
        pool,
        feeTier: fee,
        token0: t0,
        token1: t1,
        sqrtPriceX96: sqrtPriceX96.toString(),
        tick,
        liquidity: liq.toString(),
        note: "Build SwapStep[] off-chain from a quoter/API; vault accepts allowlisted router calldata only.",
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
