/**
 * Uniswap v3 mid-price from slot0 (token1/token0 in smallest units).
 * Use for guards only — not execution-quality quoting (no impact / tick traversal).
 */

/** @param {bigint} sqrtPriceX96 */
export function sqrtPriceX96ToRatioToken1PerToken0(sqrtPriceX96) {
  const Q96 = 2n ** 96n;
  const s = sqrtPriceX96;
  return (s * s) / (Q96 * Q96);
}

/**
 * Pool-implied USDC per 1 WETH (human scale), token0=USDC(6) token1=WETH(18).
 * ratio = WETH wei per 1 USDC atomic (1e-6 USDC).
 */
export function usdcPerEthFromRatio(ratio) {
  if (ratio === 0n) return 0;
  // USDC (human) per 1 ETH: 1e12 / ratio  — see rebalance / investigation notes
  return Number(1e12) / Number(ratio);
}

export function sortTokens(a, b) {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}
