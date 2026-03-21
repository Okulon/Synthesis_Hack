/**
 * Hub routing (USDC center) for WETH + USDC + one optional asset (e.g. cbETH).
 * Single-hop: direct Uniswap v3 pool. Two-hop: token → USDC → token via `exactInput` path.
 */

/**
 * @param {`0x${string}`} sell
 * @param {`0x${string}`} buy
 * @param {{ WETH: `0x${string}`; USDC: `0x${string}`; extra: null | { address: `0x${string}`; usdcPoolFee: number } }} reg
 * @returns {{ mode: 'single'; tokenIn: `0x${string}`; tokenOut: `0x${string}`; fee: number } | { mode: 'path'; tokenIn: `0x${string}`; pathTokens: `0x${string}`[]; fees: number[] }}
 */
export function buildHubRoute(sell, buy, reg) {
  const a = sell.toLowerCase();
  const b = buy.toLowerCase();
  const W = reg.WETH.toLowerCase();
  const U = reg.USDC.toLowerCase();
  const X = reg.extra?.address.toLowerCase() ?? null;
  const fX = reg.extra?.usdcPoolFee ?? 3000;

  if (a === b) throw new Error("rebalanceRoutes: sell and buy are the same token");

  const same = (p, q) => p === q;

  if (same(a, W) && same(b, U)) return { mode: "single", tokenIn: reg.WETH, tokenOut: reg.USDC, fee: 3000 };
  if (same(a, U) && same(b, W)) return { mode: "single", tokenIn: reg.USDC, tokenOut: reg.WETH, fee: 3000 };

  if (!reg.extra) {
    throw new Error(
      "rebalanceRoutes: add an optional third token under `tokens` in config/chain/*.yaml (e.g. cbETH) to trade WETH↔USDC↔extra.",
    );
  }

  if (!X) throw new Error("rebalanceRoutes: extra token address missing");

  if (same(a, X) && same(b, U)) return { mode: "single", tokenIn: reg.extra.address, tokenOut: reg.USDC, fee: fX };
  if (same(a, U) && same(b, X)) return { mode: "single", tokenIn: reg.USDC, tokenOut: reg.extra.address, fee: fX };

  if (same(a, W) && same(b, X)) {
    return {
      mode: "path",
      tokenIn: reg.WETH,
      pathTokens: [reg.WETH, reg.USDC, reg.extra.address],
      fees: [3000, fX],
    };
  }
  if (same(a, X) && same(b, W)) {
    return {
      mode: "path",
      tokenIn: reg.extra.address,
      pathTokens: [reg.extra.address, reg.USDC, reg.WETH],
      fees: [fX, 3000],
    };
  }

  throw new Error(
    `rebalanceRoutes: no hub route for sell=${sell} buy=${buy}. Supported: WETH, USDC${reg.extra ? `, ${reg.extra.address}` : ""}.`,
  );
}

/**
 * Whether the WETH/USDC v3 pool (fee 3000) is used for oracle guard.
 * @param {{ mode: string; fee?: number; pathTokens?: `0x${string}`[]; fees?: number[] }} route
 * @param {{ WETH: `0x${string}`; USDC: `0x${string}` }} reg
 */
export function routeTouchesWethUsdc3000(route, reg) {
  if (route.mode === "single") {
    const w = reg.WETH.toLowerCase();
    const u = reg.USDC.toLowerCase();
    const i = route.tokenIn.toLowerCase();
    const o = route.tokenOut.toLowerCase();
    return route.fee === 3000 && ((i === w && o === u) || (i === u && o === w));
  }
  const pts = route.pathTokens ?? [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i].toLowerCase();
    const p1 = pts[i + 1].toLowerCase();
    const w = reg.WETH.toLowerCase();
    const u = reg.USDC.toLowerCase();
    const f = route.fees?.[i];
    if (f === 3000 && ((p0 === w && p1 === u) || (p0 === u && p1 === w))) return true;
  }
  return false;
}
