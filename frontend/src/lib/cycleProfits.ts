export type CycleProfitParticipant = {
  address: string;
  trustBefore: number;
  shares1e18: string | null;
  power: number;
  weight: number;
  allocation1e18: string;
};

export type CycleProfitRow = {
  wallClockIndex: number | null;
  voteStoreCycleKey: string | null;
  onChainCycleIdBeforeClose: number | null;
  onChainCycleIdAfterClose: number | null;
  closedAt: string | null;
  txHash: string | null;
  navStart1e18: string;
  navEnd1e18: string;
  navDelta1e18: string;
  profitPool1e18: string;
  profitSource: "testgains" | "nav_delta";
  navProfit1e18: string;
  participantCount: number;
  totalPower: number;
  participants: CycleProfitParticipant[];
  allocationSum1e18: string;
  allocationMatchesPool: boolean;
  resolveWarning: string | null;
  /** Present when profitSource=testgains: uniform draw in [min,max] before max(0,·) clamp */
  testGainsRawSample1e18?: string | null;
};

export type CycleProfitsPayload = {
  unit: string;
  testGainsActive: boolean;
  testGains1e18: string | null;
  testGainsRange?: {
    min1e18: string;
    max1e18: string;
    poolClamp: string;
  } | null;
  cycles: CycleProfitRow[];
  _meta: {
    closeLogPath: string;
    updatedAt: string;
    note: string;
  };
};

export async function fetchCycleProfits(): Promise<CycleProfitsPayload> {
  const r = await fetch("/cycle-profits.json", { cache: "no-store" });
  if (!r.ok) throw new Error(`cycle-profits.json HTTP ${r.status}`);
  return r.json() as Promise<CycleProfitsPayload>;
}
