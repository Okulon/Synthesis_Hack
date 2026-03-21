/**
 * Band policy helpers — mirrors `cli.mjs` / `config/rebalancing/bands.yaml`.
 * See `docs/BAND_POLICY.md`.
 */

/**
 * Drift is always **absolute percentage points** `|w_cur − w_target| × 100` (see `docs/BAND_POLICY.md`).
 * A future `relative` metric is not implemented; `plan` warns when `bands.yaml` requests it.
 *
 * @param {object} p
 * @param {number} p.wCur
 * @param {number} p.wTgt
 * @param {number} p.globalEpsilonPp
 * @param {Record<string, number>} p.perAssetEpsilonPp
 * @param {string} p.symbol
 * @param {string} p.asset
 * @param {bigint} p.totalNAV1e18
 * @param {number} p.minTradeNotionalQuote
 */
export function computeAssetBandDecision(p) {
  const {
    wCur,
    wTgt,
    globalEpsilonPp,
    perAssetEpsilonPp,
    symbol,
    asset,
    totalNAV1e18,
    minTradeNotionalQuote,
  } = p;

  const driftPp = Math.abs(wCur - wTgt) * 100;
  const eps =
    perAssetEpsilonPp?.[symbol] ?? perAssetEpsilonPp?.[asset] ?? globalEpsilonPp;
  const notionalRough = (driftPp / 100) * (Number(totalNAV1e18) / 1e18);
  const overEps = driftPp >= eps - 1e-9;
  const overMin = notionalRough >= minTradeNotionalQuote - 1e-9;
  const wouldTrade = overEps && overMin;

  return {
    driftPp,
    epsilonPp: eps,
    notionalRough,
    decision: wouldTrade ? "would_trade" : "skip",
    skipReason: !overEps ? "within_epsilon" : !overMin ? "below_min_notional" : null,
  };
}
