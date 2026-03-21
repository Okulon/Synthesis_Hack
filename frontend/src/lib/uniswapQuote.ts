import { parseAbi, type Address, type PublicClient } from "viem";
import { QUOTER_V2 } from "./contracts";

const quoterAbi = parseAbi([
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

export function applySlippageFloor(amount: bigint, slippageBps: number): bigint {
  if (slippageBps <= 0 || slippageBps >= 10_000) return amount;
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}

/**
 * Uniswap V3 QuoterV2 single-hop quote + slippage floor for `amountOutMinimum`.
 * On revert (dead pool, RPC), returns **0** mins and `usedQuoter: false`.
 */
export async function quoteExactInputSingleOrZero(
  publicClient: PublicClient,
  params: {
    tokenIn: Address;
    tokenOut: Address;
    fee: number;
    amountIn: bigint;
    slippageBps: number;
  },
): Promise<{ quotedOut: bigint; amountOutMinimum: bigint; usedQuoter: boolean }> {
  try {
    const q = await publicClient.readContract({
      address: QUOTER_V2,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [params.tokenIn, params.tokenOut, params.fee, params.amountIn, 0n],
    });
    const quotedOut = Array.isArray(q) ? q[0] : (q as { amountOut: bigint }).amountOut;
    return {
      quotedOut,
      amountOutMinimum: applySlippageFloor(quotedOut, params.slippageBps),
      usedQuoter: true,
    };
  } catch {
    return { quotedOut: 0n, amountOutMinimum: 0n, usedQuoter: false };
  }
}
