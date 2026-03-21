/**
 * Uniswap v3 path encoding for SwapRouter02 `exactInput` / QuoterV2 `quoteExactInput`.
 * Path = token0 (20 bytes) + fee (3 bytes BE) + token1 (20) + fee + … + tokenN (20).
 */

/** @param {number} fee uint24 */
function feeToHex3(fee) {
  const n = Number(fee);
  if (!Number.isFinite(n) || n < 0 || n > 0xffffff) throw new Error(`invalid v3 fee: ${fee}`);
  return n.toString(16).padStart(6, "0");
}

/**
 * @param {`0x${string}`[]} tokens — length N
 * @param {number[]} fees — length N-1
 * @returns {`0x${string}`}
 */
export function encodeV3Path(tokens, fees) {
  if (tokens.length !== fees.length + 1) {
    throw new Error(`encodeV3Path: need fees.length === tokens.length - 1`);
  }
  let hex = "";
  for (let i = 0; i < fees.length; i++) {
    const t = tokens[i].toLowerCase().replace(/^0x/, "");
    if (t.length !== 40) throw new Error(`bad token address ${tokens[i]}`);
    hex += t + feeToHex3(fees[i]);
  }
  const last = tokens[tokens.length - 1].toLowerCase().replace(/^0x/, "");
  if (last.length !== 40) throw new Error(`bad token address ${tokens[tokens.length - 1]}`);
  hex += last;
  return `0x${hex}`;
}
