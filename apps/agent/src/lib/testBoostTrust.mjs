/**
 * Dev/test: multiplies effective portfolio return before it is rounded to `vote_return_bps` in
 * `trust-finalize-window.mjs`. Does not apply again in `trustCore` — CSV already encodes the boost.
 *
 * Env: TESTBOOSTTRUST — positive number (default 1). Example: 1e7 turns ~1e-8 effective return into
 * ~1000 bps (~10% in gain terms) before trust update.
 */
export function getTestBoostTrustMultiplier() {
  const raw = process.env.TESTBOOSTTRUST;
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}
