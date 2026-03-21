import { type Address, type Hex, encodeFunctionData } from "viem";
import { SWAP_ROUTER02, UNISWAP_POOL_FEE_WETH_USDC } from "./contracts";
import { swapRouter02Abi } from "./swapRouter02Abi";
import { TOKENS } from "./tokens";
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

/**
 * Build Uniswap v3 `exactInputSingle` calldata for `redeemToSingleAsset` when the vault holds only
 * canonical Base Sepolia WETH + USDC (fee tier 3000). Other compositions need manual paths — use basket redeem.
 */
export function buildSingleAssetRedeemSteps(opts: {
  vault: Address;
  assetOut: Address;
  assets: AssetRow[];
  slices: bigint[];
}):
  | { ok: true; steps: RedeemSwapStep[] }
  | { ok: false; reason: string } {
  const { vault, assetOut, assets, slices } = opts;
  const n = assets.length;
  const outLc = assetOut.toLowerCase();
  const outIdx = assets.findIndex((a) => a.address.toLowerCase() === outLc);
  if (outIdx < 0) return { ok: false, reason: "Output asset is not in the vault’s tracked set." };

  if (n === 1) return { ok: true, steps: [] };

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
  if (sliceOther === 0n) return { ok: true, steps: [] };

  const tokenIn = assets[otherIdx]!.address;
  const tokenOut = assets[outIdx]!.address;

  const data = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        fee: UNISWAP_POOL_FEE_WETH_USDC,
        recipient: vault,
        amountIn: sliceOther,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  return {
    ok: true,
    steps: [{ tokenIn, router: SWAP_ROUTER02, data }],
  };
}
