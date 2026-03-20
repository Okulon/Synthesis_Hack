/**
 * Dev-only: fake WETH/USDC mid so trust stamp vs finalize see non-flat returns when testnet pools are dead.
 *
 * Env:
 *   TESTWETHOCCILATOR — true/1/yes (also accepts common typo TESTWETHOSCILLATOR)
 *   TESTWETH_OSCILLATOR_BASE_USDC — human USDC per 1 WETH (default 3000)
 *   TESTWETH_OSCILLATOR_AMP — fractional swing e.g. 0.02 = ±2% sine (default 0.02)
 *   TESTWETH_OSCILLATOR_PERIOD_SEC — sine period in seconds (default 90, min 5)
 *   TESTWETH_OSCILLATOR_NOISE_BPS — uniform noise amplitude in bps (default 50)
 */

let warnedOnce = false;

function envTruthy(name) {
  const v = process.env[name];
  if (v === undefined || v === "") return false;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes";
}

export function isTestWethOscillatorEnabled() {
  return envTruthy("TESTWETHOCCILATOR") || envTruthy("TESTWETHOSCILLATOR");
}

/**
 * @returns {number} positive USDC per 1 full WETH (human)
 */
export function testWethOscillatingUsdcPerToken() {
  const base = Number(process.env.TESTWETH_OSCILLATOR_BASE_USDC ?? 3000);
  const amp = Number(process.env.TESTWETH_OSCILLATOR_AMP ?? 0.02);
  const periodSec = Math.max(5, Number(process.env.TESTWETH_OSCILLATOR_PERIOD_SEC ?? 90));
  const noiseBps = Number(process.env.TESTWETH_OSCILLATOR_NOISE_BPS ?? 50);

  const t = Date.now() / 1000;
  const wave = Math.sin((2 * Math.PI * t) / periodSec);
  const noiseFrac = ((Math.random() - 0.5) * 2 * noiseBps) / 10000;
  const b = Number.isFinite(base) && base > 0 ? base : 3000;
  const a = Number.isFinite(amp) ? Math.min(0.5, Math.max(0, amp)) : 0.02;
  const p = b * (1 + a * wave + noiseFrac);
  return Math.max(1e-9, p);
}

export function warnTestWethOscillatorOnce() {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(
    "[assetPrices] TESTWETHOCCILATOR is on — WETH/USDC uses synthetic oscillating price (not Uniswap pool). " +
      "Dev only; unset for production.",
  );
}
