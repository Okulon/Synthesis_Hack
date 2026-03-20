/**
 * Approximate token prices in USDC (human: how many USDC = 1 full token) via Uniswap v3 mid (slot0).
 * MVP: one pool hop to USDC; tries several fee tiers. Not execution-quality.
 */
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { createPublicClient, http, parseAbi } from "viem";
import { base, baseSepolia } from "viem/chains";

import { repoRoot } from "./env.mjs";
import {
  isTestWethOscillatorEnabled,
  testWethOscillatingUsdcPerToken,
  warnTestWethOscillatorOnce,
} from "./testWethOscillator.mjs";

const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);
const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint8,bool unlocked)",
]);
const erc20Abi = parseAbi(["function decimals() view returns (uint8)"]);

const ZERO = "0x0000000000000000000000000000000000000000";

function sortAddrs(a, b) {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

export function loadChainYaml(chainId) {
  const yamlPath =
    chainId === 8453
      ? path.join(repoRoot, "config/chain/base.yaml")
      : path.join(repoRoot, "config/chain/base_sepolia.yaml");
  const doc = parseYaml(fs.readFileSync(yamlPath, "utf8"));
  return doc;
}

export function pickChain(rpcUrl, chainId) {
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

/** token1 human per 1 token0 human (Uniswap v3 slot0) */
export function humanPriceToken1PerToken0(sqrtPriceX96, d0, d1) {
  const Q96 = 2 ** 96;
  const s = Number(sqrtPriceX96);
  if (!Number.isFinite(s) || s <= 0) return 0;
  const p = (s / Q96) ** 2; // token1 atomic per token0 atomic
  return p * 10 ** (d0 - d1);
}

export async function readDecimals(client, token) {
  try {
    const d = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    });
    return Number(d);
  } catch {
    return 18;
  }
}

/**
 * USDC (human) per 1 full token.
 */
export async function usdcPerTokenHuman(client, factory, usdcAddr, tokenAddr, feeTiers = [3000, 500, 10000, 100]) {
  if (tokenAddr.toLowerCase() === usdcAddr.toLowerCase()) return 1;

  const dUsdc = await readDecimals(client, usdcAddr);
  const dTok = await readDecimals(client, tokenAddr);

  const [t0, t1] = sortAddrs(usdcAddr, tokenAddr);
  const d0 = t0.toLowerCase() === usdcAddr.toLowerCase() ? dUsdc : dTok;
  const d1 = t1.toLowerCase() === usdcAddr.toLowerCase() ? dUsdc : dTok;

  for (const fee of feeTiers) {
    const pool = await client.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "getPool",
      args: [t0, t1, fee],
    });
    if (!pool || pool === ZERO) continue;

    const [sqrtPriceX96] = await client.readContract({
      address: pool,
      abi: poolAbi,
      functionName: "slot0",
    });

    const t1PerT0 = humanPriceToken1PerToken0(sqrtPriceX96, d0, d1);
    if (!Number.isFinite(t1PerT0) || t1PerT0 <= 0) continue;

    if (t0.toLowerCase() === usdcAddr.toLowerCase()) {
      // token0 = USDC, token1 = TOKEN → TOKEN per USDC
      return 1 / t1PerT0;
    }
    // token0 = TOKEN, token1 = USDC
    return t1PerT0;
  }

  return null;
}

/**
 * @param {import('viem').PublicClient} client
 * @param {any} yamlDoc from loadChainYaml
 * @param {string[]} tokenAddresses
 * @returns {Promise<{ prices: Record<string, number | null>, errors: string[] }>}
 */
export async function fetchUsdcPricesForTokens(client, yamlDoc, tokenAddresses) {
  const factory = yamlDoc.uniswap?.v3_factory;
  const usdc = yamlDoc.tokens?.USDC?.address;
  if (!factory || !usdc) throw new Error("chain yaml: need uniswap.v3_factory and tokens.USDC");

  const uniq = [...new Set(tokenAddresses.filter(Boolean).map((a) => a.toLowerCase()))];
  const prices = {};
  const errors = [];

  const wethAddr = yamlDoc.tokens?.WETH?.address?.toLowerCase?.() ?? null;
  const useWethOsc = isTestWethOscillatorEnabled() && wethAddr;

  for (const addr of uniq) {
    try {
      if (useWethOsc && addr === wethAddr) {
        warnTestWethOscillatorOnce();
        prices[addr] = testWethOscillatingUsdcPerToken();
        continue;
      }
      const p = await usdcPerTokenHuman(client, factory, usdc, addr);
      prices[addr] = p;
      if (p == null || !Number.isFinite(p)) errors.push(`no USDC pool (tried common fees): ${addr}`);
    } catch (e) {
      prices[addr] = null;
      errors.push(`${addr}: ${e?.message ?? e}`);
    }
  }

  return { prices, errors };
}

export function makeChainClient() {
  const rpcUrl = process.env.CHAIN_RPC_URL;
  if (!rpcUrl) throw new Error("Missing CHAIN_RPC_URL");
  const chainId = Number(process.env.CHAIN_ID ?? "84532");
  const { chain, transport } = pickChain(rpcUrl, chainId);
  return { client: createPublicClient({ chain, transport }), chainId };
}
