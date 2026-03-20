import type { Address } from "viem";

export const DEFAULT_TRUST_SCORE = 1;

export type TrustScoresFile = {
  trustByVoter: Record<string, number>;
  _meta?: { updatedAt?: string; note?: string; scoringRule?: string };
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

export function trustForAddress(
  trustByVoter: Record<string, number>,
  address: Address,
): { score: number; isDefault: boolean } {
  const key = address.toLowerCase();
  if (key in trustByVoter && Number.isFinite(trustByVoter[key])) {
    return { score: trustByVoter[key], isDefault: false };
  }
  return { score: DEFAULT_TRUST_SCORE, isDefault: true };
}
