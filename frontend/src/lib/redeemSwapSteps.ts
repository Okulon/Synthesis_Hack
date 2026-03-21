import { type Address, type Hex, encodeFunctionData } from "viem";
import type { PublicClient } from "viem";
import { SWAP_ROUTER02, UNISWAP_POOL_FEE_WETH_USDC } from "./contracts";
import { swapRouter02Abi } from "./swapRouter02Abi";
import { TOKENS } from "./tokens";
import { quoteExactInputSingleOrZero } from "./uniswapQuote";
import type { AssetRow } from "./vault";

export type RedeemSwapStep = { tokenIn: Address; router: Address; data: Hex };

function mulDivFloorShares(balance: bigint, shares: bigint, supply: bigint): bigint {
  if (supply === 0n) return 0n;
  return (balance * shares) / supply;
}

/** Per-tracked-asset slice for `shares` / `totalSupply` (matches vault `redeem*` floor math). */
export function computeRedeemSlices(assets: AssetRow[], shares: bigint, totalSupply: bigint): bigint[] {
  return assets.map((a) => mulDivFloorShares(a.balanceRaw, shares, totalSupply));
}

type RedeemPlan =
  | { kind: "no_swap"; sliceOut: bigint }
  | {
      kind: "swap";
      tokenIn: Address;
      tokenOut: Address;
      fee: number;
      amountIn: bigint;
      sliceOut: bigint;
    };

function getSingleAssetRedeemPlan(opts: {
  assetOut: Address;
  assets: AssetRow[];
  slices: bigint[];
}): { ok: true; plan: RedeemPlan } | { ok: false; reason: string } {
  const { assetOut, assets, slices } = opts;
  const n = assets.length;
  const outLc = assetOut.toLowerCase();
  const outIdx = assets.findIndex((a) => a.address.toLowerCase() === outLc);
  if (outIdx < 0) return { ok: false, reason: "Output asset is not in the vault’s tracked set." };

  const sliceOut = slices[outIdx]!;

  if (n === 1) return { ok: true, plan: { kind: "no_swap", sliceOut } };

  if (n !== 2) {
    return {
      ok: false,
      reason: `Single-asset exit with auto-swap supports only 2 tracked assets (this vault has ${n}). Use basket redeem.`,
    };
  }

  const weth = TOKENS.WETH.address.toLowerCase();
  const usdc = TOKENS.USDC.address.toLowerCase();
  const addrs = assets.map((a) => a.address.toLowerCase());
  if (!addrs.every((x) => x === weth || x === usdc)) {
    return {
      ok: false,
      reason: "Auto swap path is only wired for WETH + USDC on Base Sepolia. Use basket redeem.",
    };
  }

  const otherIdx = outIdx === 0 ? 1 : 0;
  const sliceOther = slices[otherIdx]!;
  if (sliceOther === 0n) return { ok: true, plan: { kind: "no_swap", sliceOut } };

  const tokenIn = assets[otherIdx]!.address;
  const tokenOut = assets[outIdx]!.address;

  return {
    ok: true,
    plan: {
      kind: "swap",
      tokenIn,
      tokenOut,
      fee: UNISWAP_POOL_FEE_WETH_USDC,
      amountIn: sliceOther,
      sliceOut,
    },
  };
}

function encodeSwapStep(opts: {
  vault: Address;
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  amountIn: bigint;
  amountOutMinimum: bigint;
}): RedeemSwapStep {
  const data = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: opts.tokenIn,
        tokenOut: opts.tokenOut,
        fee: opts.fee,
        recipient: opts.vault,
        amountIn: opts.amountIn,
        amountOutMinimum: opts.amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  return { tokenIn: opts.tokenIn, router: SWAP_ROUTER02, data };
}

/**
 * Build Uniswap v3 `exactInputSingle` calldata for `redeemToSingleAsset` when the vault holds only
 * canonical Base Sepolia WETH + USDC (fee tier 3000). Other compositions need manual paths — use basket redeem.
 *
 * @param swapAmountOutMinimum — when omitted, uses **0** (legacy testnet demo). Prefer {@link quoteSingleAssetRedeem}.
 */
export function buildSingleAssetRedeemSteps(opts: {
  vault: Address;
  assetOut: Address;
  assets: AssetRow[];
  slices: bigint[];
  swapAmountOutMinimum?: bigint;
}):
  | { ok: true; steps: RedeemSwapStep[] }
  | { ok: false; reason: string } {
  const { vault, swapAmountOutMinimum = 0n } = opts;
  const inner = getSingleAssetRedeemPlan(opts);
  if (!inner.ok) return inner;

  if (inner.plan.kind === "no_swap") return { ok: true, steps: [] };

  const p = inner.plan;
  return {
    ok: true,
    steps: [
      encodeSwapStep({
        vault,
        tokenIn: p.tokenIn,
        tokenOut: p.tokenOut,
        fee: p.fee,
        amountIn: p.amountIn,
        amountOutMinimum: swapAmountOutMinimum,
      }),
    ],
  };
}

/**
 * Quote Uniswap V3 QuoterV2 and build steps + vault `minAmountOut` for single-asset redeem.
 * Falls back to **0** min outs if the quoter reverts (e.g. dead pool) — same as legacy demo behavior.
 */
export async function quoteSingleAssetRedeem(opts: {
  publicClient: PublicClient;
  assetOut: Address;
  assets: AssetRow[];
  slices: bigint[];
  vault: Address;
  slippageBps: number;
}): Promise<
  | { ok: true; steps: RedeemSwapStep[]; minAmountOut: bigint; quotedSwapOut: bigint | null; usedQuoter: boolean }
  | { ok: false; reason: string }
> {
  const { publicClient, assetOut, assets, slices, vault, slippageBps } = opts;
  const inner = getSingleAssetRedeemPlan({ assetOut, assets, slices });
  if (!inner.ok) return inner;

  const plan = inner.plan;

  if (plan.kind === "no_swap") {
    return {
      ok: true,
      steps: [],
      minAmountOut: plan.sliceOut,
      quotedSwapOut: null,
      usedQuoter: false,
    };
  }

  const q = await quoteExactInputSingleOrZero(publicClient, {
    tokenIn: plan.tokenIn,
    tokenOut: plan.tokenOut,
    fee: plan.fee,
    amountIn: plan.amountIn,
    slippageBps,
  });
  const quotedSwapOut = q.usedQuoter ? q.quotedOut : 0n;
  const swapMinOut = q.amountOutMinimum;
  /** Vault check: user receives `sliceOut` of assetOut plus swap output; one slippage layer on the quoted swap. */
  const minAmountOut = q.usedQuoter ? plan.sliceOut + swapMinOut : 0n;

  const built = buildSingleAssetRedeemSteps({
    vault,
    assetOut,
    assets,
    slices,
    swapAmountOutMinimum: swapMinOut,
  });
  if (!built.ok) return built;

  return {
    ok: true,
    steps: built.steps,
    minAmountOut,
    quotedSwapOut: q.usedQuoter ? quotedSwapOut : null,
    usedQuoter: q.usedQuoter,
  };
}
