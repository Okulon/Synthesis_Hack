/**
 * Per-cycle trust history from `npm run trust:export` → `public/trust-history.json`.
 */

export type TrustHistoryStep = {
  cycle_id: string;
  vote_return_bps: number;
  benchmark_return_bps: number;
  trust_before: number;
  trust_after: number;
  delta_trust: number;
  weights?: Record<string, number>;
};

export type TrustHistoryPayload = {
  defaultTrust: number;
  trustFloor: number;
  trustCeiling: number;
  scoringRule: string;
  linearScale: number;
  byVoter: Record<string, TrustHistoryStep[]>;
  _meta?: { updatedAt?: string; note?: string; csvSource?: string };
};

export async function fetchTrustHistory(): Promise<TrustHistoryPayload | null> {
  try {
    const res = await fetch("/trust-history.json", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as TrustHistoryPayload;
  } catch {
    return null;
  }
}

/** Human-readable portfolio return from bps (1 bps = 0.01%). */
export function formatBpsAsPercent(bps: number): string {
  if (!Number.isFinite(bps)) return "—";
  const pct = bps / 100;
  if (Math.abs(pct) >= 1000 || Math.abs(pct) < 0.0001) {
    return `${pct >= 0 ? "+" : ""}${pct.toExponential(2)}%`;
  }
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(4)}%`;
}
