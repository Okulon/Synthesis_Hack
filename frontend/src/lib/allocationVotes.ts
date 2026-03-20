export type AllocationVoterRow = {
  address: string;
  trust: number;
  weights: Record<string, number>;
  share1e18?: string | null;
  votingPower?: number;
  submittedAt?: string | null;
};

import type { ManagedClockPayload } from "./managedCycle";

export type AllocationVotesPayload = {
  kind?: "legacy" | "vote-store";
  cycleId: number;
  onChainCycleId?: number;
  cycleKey?: string | null;
  activeVoteCycleKey?: string | null;
  managedWindowIndex?: number | null;
  managedClock?: ManagedClockPayload | null;
  voterCount: number;
  uniqueVoters?: number;
  votingOpen?: boolean | null;
  snapshotBlock?: string | null;
  snapshotCapturedAt?: string | null;
  aggregationMode?: string;
  warnings?: string[];
  voters: AllocationVoterRow[];
  targets: Record<string, number>;
  /** From `config/governance/defaults.yaml` at export time */
  governance?: {
    quorumFraction: number;
    approvalThresholdFraction: number;
  };
  _meta?: {
    votesSource?: string;
    updatedAt?: string;
    rawSum?: number;
    trustMass?: number;
    note?: string;
    cycleLabel?: string | null;
  };
};

export async function fetchAllocationVotes(): Promise<AllocationVotesPayload> {
  const res = await fetch("/allocation-votes.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`allocation-votes.json: ${res.status}`);
  const j = (await res.json()) as AllocationVotesPayload;
  if (!j.targets || typeof j.targets !== "object") throw new Error("invalid allocation-votes.json");
  return j;
}

export function pctFromFraction(f: number): string {
  if (!Number.isFinite(f)) return "—";
  return `${(f * 100).toFixed(2)}%`;
}
