import assert from "node:assert/strict";
import test from "node:test";

import { computeAssetBandDecision } from "./bandPolicy.mjs";

test("absolute_pp: trades when drift >= epsilon", () => {
  const r = computeAssetBandDecision({
    wCur: 0.55,
    wTgt: 0.5,
    globalEpsilonPp: 1.0,
    perAssetEpsilonPp: {},
    symbol: "WETH",
    asset: "0x1",
    totalNAV1e18: 1_000_000_000_000_000_000n,
    minTradeNotionalQuote: 0,
  });
  assert.equal(r.decision, "would_trade");
  assert.ok(r.driftPp >= 1);
});

test("absolute_pp: skips when drift below epsilon", () => {
  const r = computeAssetBandDecision({
    wCur: 0.505,
    wTgt: 0.5,
    globalEpsilonPp: 1.0,
    perAssetEpsilonPp: {},
    symbol: "WETH",
    asset: "0x1",
    totalNAV1e18: 1_000_000_000_000_000_000n,
    minTradeNotionalQuote: 0,
  });
  assert.equal(r.decision, "skip");
  assert.equal(r.skipReason, "within_epsilon");
});

test("0% target: drift equals current weight in pp", () => {
  const r = computeAssetBandDecision({
    wCur: 0.2,
    wTgt: 0,
    globalEpsilonPp: 1.0,
    perAssetEpsilonPp: {},
    symbol: "VOL",
    asset: "0x2",
    totalNAV1e18: 10n ** 18n,
    minTradeNotionalQuote: 0,
  });
  assert.equal(r.driftPp, 20);
  assert.equal(r.decision, "would_trade");
});

test("min notional blocks dust when epsilon passes", () => {
  const r = computeAssetBandDecision({
    wCur: 0.6,
    wTgt: 0,
    globalEpsilonPp: 0.01,
    perAssetEpsilonPp: {},
    symbol: "DUST",
    asset: "0x3",
    totalNAV1e18: 10n ** 18n,
    minTradeNotionalQuote: 1_000_000,
  });
  assert.equal(r.decision, "skip");
  assert.equal(r.skipReason, "below_min_notional");
});

