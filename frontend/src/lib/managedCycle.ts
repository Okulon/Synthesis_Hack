/** Payload from allocation-votes.json — enough to compute live phase in the browser */
export type ManagedClockPayload = {
  genesisUnix: number;
  durationSec: number;
  votingSec: number;
  frozenSec: number;
  serverNowSec: number;
  live: ManagedCycleLive;
};

export type ManagedCycleLive = {
  index: number;
  cycleStartSec: number;
  cycleEndSec: number;
  phase: string;
  votingSec: number;
  frozenSec: number;
  durationSec: number;
  genesisUnix: number;
  phaseEndsAtSec: number;
  secondsUntilPhaseEnd: number;
  secondsUntilCycleEnd: number;
  calendarCycleStartIso: string;
  calendarCycleEndIso: string;
};

export function computeLiveManagedCycle(
  c: Pick<ManagedClockPayload, "genesisUnix" | "durationSec" | "votingSec" | "frozenSec">,
  nowMs: number = Date.now()
): ManagedCycleLive {
  const nowSec = Math.floor(nowMs / 1000);
  const rel = nowSec - c.genesisUnix;
  const index = Math.floor(rel / c.durationSec);
  const cycleStartSec = c.genesisUnix + index * c.durationSec;
  const cycleEndSec = cycleStartSec + c.durationSec;
  const tInCycle = nowSec - cycleStartSec;
  const inVoting = tInCycle >= 0 && tInCycle < c.votingSec;
  const phase = tInCycle < 0 ? "before_genesis" : inVoting ? "voting" : "frozen";
  const phaseEndsAtSec = inVoting ? cycleStartSec + c.votingSec : cycleEndSec;
  const secondsUntilPhaseEnd = Math.max(0, phaseEndsAtSec - nowSec);
  const secondsUntilCycleEnd = Math.max(0, cycleEndSec - nowSec);
  return {
    index,
    cycleStartSec,
    cycleEndSec,
    phase,
    votingSec: c.votingSec,
    frozenSec: c.frozenSec,
    durationSec: c.durationSec,
    genesisUnix: c.genesisUnix,
    phaseEndsAtSec,
    secondsUntilPhaseEnd,
    secondsUntilCycleEnd,
    calendarCycleStartIso: new Date(cycleStartSec * 1000).toISOString(),
    calendarCycleEndIso: new Date(cycleEndSec * 1000).toISOString(),
  };
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}
