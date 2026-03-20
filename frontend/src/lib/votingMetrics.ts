import { formatUnits, type Address } from "viem";

import { type TrustForAddressOpts, trustForAddress } from "./trustScores";
import type { OnChainAllocationBallot, VaultSnapshot } from "./vault";

export type QuorumStats = {
  totalPower: number;
  participatingPower: number;
  quorumTarget: number;
  quorumFraction: number;
  participationRate: number;
  quorumMet: boolean;
  holderCount: number;
  votedCount: number;
};

export function computeQuorumStats(
  snap: VaultSnapshot,
  trustByVoter: Record<string, number>,
  quorumFraction: number,
  votedAddresses: Set<string>,
  trustOpts?: TrustForAddressOpts,
): QuorumStats {
  let totalPower = 0;
  let participatingPower = 0;
  let votedCount = 0;

  for (const h of snap.holders) {
    const { score: trust } = trustForAddress(trustByVoter, h.address, trustOpts);
    const sharesNum = Number(formatUnits(h.balance, 18));
    const potential = trust * sharesNum;
    totalPower += potential;
    if (votedAddresses.has(h.address.toLowerCase())) {
      votedCount++;
      participatingPower += potential;
    }
  }

  const quorumTarget = totalPower * quorumFraction;
  const participationRate = totalPower > 0 ? participatingPower / totalPower : 0;
  const quorumMet = totalPower <= 0 ? false : participatingPower >= quorumTarget - 1e-12;

  return {
    totalPower,
    participatingPower,
    quorumTarget,
    quorumFraction,
    participationRate,
    quorumMet,
    holderCount: snap.holders.length,
    votedCount,
  };
}

export type HolderVoteRow = {
  address: Address;
  balance: bigint;
  sharesLabel: string;
  trust: number;
  trustIsDefault: boolean;
  /** Voted on-chain but no row in trust-scores.json yet — score is still default 1.0 */
  trustPendingFinalize?: boolean;
  /** Trust number came from allocation-votes.json because trust-scores had no row (same aggregate math) */
  trustFromAllocationExport?: boolean;
  displayPower: number;
  voted: boolean;
  /** In allocation-votes export but no matching on-chain ballot in the log window */
  votedOffChainOnly?: boolean;
  /** Weights from allocation-votes.json when votedOffChainOnly */
  offChainWeights?: Record<string, number> | null;
  weightsBps: number[] | null;
};

function ballotMapByVoter(ballots: OnChainAllocationBallot[]): Map<string, OnChainAllocationBallot> {
  const m = new Map<string, OnChainAllocationBallot>();
  for (const b of ballots) {
    m.set(b.voter.toLowerCase(), b);
  }
  return m;
}

export function buildHolderVoteRows(
  snap: VaultSnapshot,
  trustByVoter: Record<string, number>,
  trustOpts?: TrustForAddressOpts,
  allocationVoters?: ReadonlyArray<{
    address: string;
    trust: number;
    weights?: Record<string, number>;
  }>,
): HolderVoteRow[] {
  const bMap = ballotMapByVoter(snap.onChainAllocationBallots);
  const allocationByAddr = new Map<string, number>();
  const allocationWeightsByAddr = new Map<string, Record<string, number>>();
  const allocationVoterSet = new Set<string>();
  for (const v of allocationVoters ?? []) {
    const k = v.address.toLowerCase();
    allocationVoterSet.add(k);
    if (Number.isFinite(v.trust)) allocationByAddr.set(k, v.trust);
    if (v.weights && typeof v.weights === "object") allocationWeightsByAddr.set(k, v.weights);
  }

  const rows: HolderVoteRow[] = snap.holders.map((h) => {
    const k = h.address.toLowerCase();
    const fromCsv = trustByVoter[k];
    const fromAlloc = allocationByAddr.get(k);
    const base = trustForAddress(trustByVoter, h.address, trustOpts);

    let trust: number;
    let trustIsDefault: boolean;
    let trustPendingFinalize: boolean | undefined;
    let trustFromAllocationExport: boolean | undefined;

    if (Number.isFinite(fromCsv)) {
      trust = fromCsv;
      trustIsDefault = false;
      trustPendingFinalize = false;
      trustFromAllocationExport = false;
    } else if (fromAlloc != null && Number.isFinite(fromAlloc)) {
      trust = fromAlloc;
      trustIsDefault = false;
      trustPendingFinalize = false;
      trustFromAllocationExport = true;
    } else {
      trust = base.score;
      trustIsDefault = base.isDefault;
      trustPendingFinalize = base.pendingTrustFinalize;
      trustFromAllocationExport = false;
    }

    const sharesLabel = formatUnits(h.balance, 18);
    const sharesNum = Number(sharesLabel);
    const b = bMap.get(k);
    const voted = !!b;
    const votedOffChainOnly = allocationVoterSet.has(k) && !b;
    const offChainWeights = votedOffChainOnly ? allocationWeightsByAddr.get(k) ?? null : null;
    const displayPower = trust * sharesNum;
    return {
      address: h.address,
      balance: h.balance,
      sharesLabel,
      trust,
      trustIsDefault,
      trustPendingFinalize,
      trustFromAllocationExport,
      displayPower,
      voted,
      votedOffChainOnly,
      offChainWeights,
      weightsBps: b ? b.weightsBps : null,
    };
  });
  rows.sort((a, b) => (a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1));
  return rows;
}

/** Trust × shares × on-chain weights (bps) → normalized targets by asset address. */
export function computeOnChainTargets(
  snap: VaultSnapshot,
  trustByVoter: Record<string, number>,
  trustOpts?: TrustForAddressOpts,
): {
  targets: Record<string, number>;
  warnings: string[];
  /** Sum of (trust × shares) for ballots included in the blend (equals pre-normalize weight mass). */
  votingPowerSum: number;
  ballotCount: number;
} {
  const warnings: string[] = [];
  const ballots = snap.onChainAllocationBallots;
  if (ballots.length === 0) {
    return {
      targets: {},
      warnings: ["No on-chain ballots for this vault cycle in the log scan window."],
      votingPowerSum: 0,
      ballotCount: 0,
    };
  }

  const n = snap.ballotAssets.length;
  const acc: Record<string, number> = {};
  let ballotCount = 0;

  for (const b of ballots) {
    if (b.weightsBps.length !== n) {
      warnings.push(`Ballot ${b.voter}: expected ${n} ballot slots, got ${b.weightsBps.length}`);
      continue;
    }
    let sumBps = 0;
    for (const w of b.weightsBps) sumBps += w;
    if (sumBps !== 10_000) {
      warnings.push(`Ballot ${b.voter}: bps sum ${sumBps} (need 10000)`);
      continue;
    }

    const { score: trust } = trustForAddress(trustByVoter, b.voter, trustOpts);
    const holder = snap.holders.find((h) => h.address.toLowerCase() === b.voter.toLowerCase());
    const sharesNum = holder ? Number(formatUnits(holder.balance, 18)) : 0;
    if (sharesNum <= 0) continue;

    const power = trust * sharesNum;
    ballotCount++;
    for (let i = 0; i < n; i++) {
      const addr = snap.ballotAssets[i]!.address.toLowerCase();
      const frac = b.weightsBps[i] / 10_000;
      acc[addr] = (acc[addr] ?? 0) + power * frac;
    }
  }

  const raw = Object.values(acc).reduce((a, v) => a + v, 0);
  if (raw <= 0) {
    return {
      targets: {},
      warnings: [...warnings, "Could not aggregate on-chain ballots (no matching holder power)."],
      votingPowerSum: 0,
      ballotCount: 0,
    };
  }

  const targets: Record<string, number> = {};
  for (const [k, v] of Object.entries(acc)) {
    targets[k] = v / raw;
  }
  return { targets, warnings, votingPowerSum: raw, ballotCount };
}

export function votedAddressSet(ballots: OnChainAllocationBallot[]): Set<string> {
  return new Set(ballots.map((b) => b.voter.toLowerCase()));
}
