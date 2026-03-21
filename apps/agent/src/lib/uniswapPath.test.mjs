import assert from "node:assert/strict";
import test from "node:test";

import { encodeV3Path } from "./uniswapPath.mjs";

test("encodeV3Path two hops matches expected length (20+3+20+3+20 bytes)", () => {
  const weth = "0x4200000000000000000000000000000000000006";
  const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const cb = "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22";
  const p = encodeV3Path([weth, usdc, cb], [3000, 500]);
  assert.equal(p.length, 2 + 40 * 3 + 6 * 2);
});
