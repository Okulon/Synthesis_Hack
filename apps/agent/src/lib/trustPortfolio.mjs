/**
 * Time-weighted portfolio return for trust updates:
 * portfolio gain from vote-time prices → cycle-end prices, scaled by (cycleEnd - voteTime) / cycleDuration.
 */

/**
 * @param {number} voteSec
 * @param {number} cycleStartSec
 * @param {number} cycleEndSec
 * @param {number} durationSec
 * @returns {number} in [0, 1]
 */
export function timeWeightRemainingInCycle(voteSec, cycleStartSec, cycleEndSec, durationSec) {
  if (durationSec <= 0) return 0;
  const v = Math.min(Math.max(Number(voteSec), cycleStartSec), cycleEndSec);
  return Math.max(0, (cycleEndSec - v) / durationSec);
}

/**
 * Weighted basket return: sum_a w_a * (end[a]/start[a] - 1). Weights keyed lowercase.
 * @param {Record<string, number>} weights
 * @param {Record<string, number>} startPrices lowercased keys, USDC per token
 * @param {Record<string, number>} endPrices same
 */
export function portfolioReturnDecimal(weights, startPrices, endPrices) {
  let sum = 0;
  for (const [addr, w] of Object.entries(weights)) {
    const k = addr.toLowerCase();
    const p0 = startPrices[k];
    const p1 = endPrices[k];
    if (p0 == null || p1 == null || !Number.isFinite(p0) || !Number.isFinite(p1) || p0 <= 0 || p1 < 0) {
      continue;
    }
    sum += Number(w) * (p1 / p0 - 1);
  }
  return sum;
}

/**
 * @param {string | null | undefined} submittedAt ISO
 * @param {number} cycleStartSec fallback when missing
 */
export function voteUnixFromSubmittedAt(submittedAt, cycleStartSec) {
  if (!submittedAt) return cycleStartSec;
  const t = Date.parse(submittedAt);
  if (Number.isNaN(t)) return cycleStartSec;
  return Math.floor(t / 1000);
}

/**
 * Wall-clock bounds for vote-store cycle key (integer index aligned with cycle:sync).
 */
export function cycleWindowBounds(genesisUnix, durationSec, cycleIndex) {
  const start = genesisUnix + cycleIndex * durationSec;
  const end = start + durationSec;
  return { cycleStartSec: start, cycleEndSec: end };
}

/**
 * Last ballot wins per voter (same semantics as aggregate).
 * @param {import("./voteStore.mjs").Ballot[]} ballots
 */
export function lastBallotByVoter(ballots) {
  const map = new Map();
  for (const b of ballots) {
    if (!b.voter) continue;
    map.set(b.voter.toLowerCase(), b);
  }
  return map;
}
