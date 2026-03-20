/**
 * Allocation quorum (same formula as `frontend/src/lib/votingMetrics.ts`):
 * participatingPower = Σ (trust × shares) for holders who cast a ballot for this cycle;
 * totalPower = Σ (trust × shares) over all holders with balance > 0;
 * quorumMet ⇔ participatingPower ≥ totalPower × quorumFraction.
 */

/**
 * @param {{ address: `0x${string}`; balance: bigint }[]} holders
 * @param {Record<string, number>} trustByVoter lowercase
 * @param {number} defaultTrust
 * @param {number} quorumFraction e.g. 0.15
 * @param {Set<string>} votedAddresses lowercase
 */
export function computeAllocQuorumStats(holders, trustByVoter, defaultTrust, quorumFraction, votedAddresses) {
  let totalPower = 0;
  let participatingPower = 0;
  let votedCount = 0;

  for (const h of holders) {
    const k = h.address.toLowerCase();
    const trust = Number(trustByVoter[k] ?? defaultTrust);
    if (!Number.isFinite(trust) || trust <= 0) continue;
    const sharesNum = Number(h.balance) / 1e18;
    if (!Number.isFinite(sharesNum)) continue;
    const potential = trust * sharesNum;
    totalPower += potential;
    if (votedAddresses.has(k)) {
      votedCount += 1;
      participatingPower += potential;
    }
  }

  const quorumTarget = totalPower * quorumFraction;
  const quorumMet = totalPower <= 0 ? false : participatingPower >= quorumTarget - 1e-12;

  return {
    totalPower,
    participatingPower,
    quorumTarget,
    quorumFraction,
    quorumMet,
    holderCount: holders.length,
    votedCount,
  };
}
