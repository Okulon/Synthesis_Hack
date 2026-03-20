import type { Address } from "viem";

export const DEFAULT_TRUST_SCORE = 1;

export type TrustScoresFile = {
  trustByVoter: Record<string, number>;
  _meta?: {
    updatedAt?: string;
    note?: string;
    scoringRule?: string;
    csvRowCount?: number;
    missingLocalCsv?: boolean;
    /** Off-chain ballot voters not yet in trust CSV (from agent export). */
    votersPendingTrustFinalize?: string[];
  };
};

/** Fetches `/trust-scores.json` from dev server or production `public/`. */
export async function fetchTrustScores(): Promise<TrustScoresFile> {
  const res = await fetch("/trust-scores.json", { cache: "no-store" });
  if (!res.ok) {
    return { trustByVoter: {} };
  }
  const j = (await res.json()) as TrustScoresFile;
  const raw = j.trustByVoter ?? {};
  const trustByVoter: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    trustByVoter[k.toLowerCase()] = Number(v);
  }
  return { trustByVoter, _meta: j._meta };
}

export type TrustForAddressOpts = {
  /** On-chain ballot casters — if address voted but has no trust-scores row, still default 1.0 but flagged */
  onChainBallotVoters?: Set<string>;
  /** From trust-scores.json _meta (off-chain vote-store voters not in CSV yet) */
  offChainBallotVotersPending?: Set<string>;
};

export function trustForAddress(
  trustByVoter: Record<string, number>,
  address: Address,
  opts?: TrustForAddressOpts,
): { score: number; isDefault: boolean; pendingTrustFinalize?: boolean } {
  const key = address.toLowerCase();
  if (key in trustByVoter && Number.isFinite(trustByVoter[key])) {
    return { score: trustByVoter[key], isDefault: false };
  }
  const pendingOnChain = opts?.onChainBallotVoters?.has(key) === true;
  const pendingOffChain = opts?.offChainBallotVotersPending?.has(key) === true;
  if (pendingOnChain || pendingOffChain) {
    return { score: DEFAULT_TRUST_SCORE, isDefault: true, pendingTrustFinalize: true };
  }
  return { score: DEFAULT_TRUST_SCORE, isDefault: true };
}

/** Build once per snap for trustForAddress opts */
export function onChainBallotVoterSetFromSnap(
  ballots: readonly { voter: Address }[],
): Set<string> {
  return new Set(ballots.map((b) => b.voter.toLowerCase()));
}
