import { parseAbi } from "viem";

/** Uniswap V3 `SwapRouter02` on Base / Base Sepolia — single-hop swap. */
export const swapRouter02Abi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);
