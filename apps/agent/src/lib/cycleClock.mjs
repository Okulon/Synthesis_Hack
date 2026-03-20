/**
 * Wall-clock allocation cycles — off-chain schedule independent from vault.closeCycle.
 *
 * - **Schedule** (duration, voting vs frozen): `config/agent/cycles.yaml` only.
 * - **Pinned time origin**: `config/local/cycle-clock.json` — `genesisUnix` only (v2 schema).
 */
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";

import { repoRoot } from "./env.mjs";

export function cycleClockConfigPath() {
  return path.join(repoRoot, "config/agent/cycles.yaml");
}

export function cycleClockStatePath() {
  return path.join(repoRoot, "config/local/cycle-clock.json");
}

export function loadCycleClockYaml() {
  const p = cycleClockConfigPath();
  const doc = parseYaml(fs.readFileSync(p, "utf8"));
  const c = doc.cycle_clock ?? {};
  const durationMin = Number(c.duration_minutes ?? 30);
  const votingMin = Number(c.voting_minutes ?? 25);
  const frozenMin = Number(c.frozen_minutes ?? Math.max(0, durationMin - votingMin));
  const durationSec = Math.round(durationMin * 60);
  let votingSec = Math.round(votingMin * 60);
  let frozenSec = Math.round(frozenMin * 60);
  if (votingSec + frozenSec !== durationSec) {
    frozenSec = Math.max(0, durationSec - votingSec);
  }
  return { durationMin, votingMin, frozenMin, durationSec, votingSec, frozenSec };
}

/**
 * @returns {{ genesisUnix: number, durationSec: number, votingSec: number, frozenSec: number, version: number } | null}
 */
export function loadCycleClockState() {
  const p = cycleClockStatePath();
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const y = loadCycleClockYaml();
  return {
    version: j.version ?? 1,
    genesisUnix: Number(j.genesisUnix),
    /** Always from `cycles.yaml` so schedule edits apply without deleting cycle-clock.json. */
    durationSec: y.durationSec,
    votingSec: y.votingSec,
    frozenSec: y.frozenSec,
  };
}

/**
 * Pin genesis to the start of the current window (floor now to duration boundary from YAML).
 * Writes only genesis to disk; schedule always comes from `cycles.yaml`.
 * @returns {NonNullable<ReturnType<typeof loadCycleClockState>>}
 */
export function initCycleClockState() {
  const y = loadCycleClockYaml();
  const now = Math.floor(Date.now() / 1000);
  const genesisUnix = now - (now % y.durationSec);
  const file = {
    version: 2,
    genesisUnix,
    updatedAt: new Date().toISOString(),
  };
  const dest = cycleClockStatePath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(file, null, 2));
  return /** @type {NonNullable<ReturnType<typeof loadCycleClockState>>} */ (loadCycleClockState());
}

/**
 * @param {number} [nowSec]
 */
export function computeManagedCycle(nowSec = Math.floor(Date.now() / 1000)) {
  const s = loadCycleClockState();
  if (!s) return null;
  const { genesisUnix, durationSec, votingSec, frozenSec } = s;
  if (!Number.isFinite(genesisUnix) || durationSec <= 0) return null;

  const rel = nowSec - genesisUnix;
  const index = rel >= 0 ? Math.floor(rel / durationSec) : -1;
  const cycleStartSec = genesisUnix + index * durationSec;
  const cycleEndSec = cycleStartSec + durationSec;
  const tInCycle = nowSec - cycleStartSec;
  const inVoting = tInCycle >= 0 && tInCycle < votingSec;
  const phase = tInCycle < 0 ? "before_genesis" : inVoting ? "voting" : "frozen";

  const phaseEndsAtSec = inVoting ? cycleStartSec + votingSec : cycleEndSec;
  const secondsUntilPhaseEnd = Math.max(0, phaseEndsAtSec - nowSec);
  const secondsUntilCycleEnd = Math.max(0, cycleEndSec - nowSec);

  return {
    index,
    cycleStartSec,
    cycleEndSec,
    phase,
    votingSec,
    frozenSec,
    durationSec,
    genesisUnix,
    phaseEndsAtSec,
    secondsUntilPhaseEnd,
    secondsUntilCycleEnd,
    calendarCycleStartIso: new Date(cycleStartSec * 1000).toISOString(),
    calendarCycleEndIso: new Date(cycleEndSec * 1000).toISOString(),
  };
}

/**
 * Ensures `cycle-clock.json` exists and describes a valid current window (same as `cycle:clock-init` when needed).
 * Call from `cycle:sync`, agent, etc. — no separate manual clock-init step.
 * @returns {NonNullable<ReturnType<typeof loadCycleClockState>>}
 */
export function ensureCycleClockReady() {
  migrateCycleClockFileToGenesisOnly();

  let state = null;
  try {
    state = loadCycleClockState();
  } catch (e) {
    console.warn("[cycle-clock] cycle-clock.json unreadable — re-initializing:", (e && e.message) || e);
    state = null;
  }

  const looksBroken = () => {
    if (!state) return true;
    if (!Number.isFinite(state.genesisUnix) || !(state.durationSec > 0)) return true;
    const m = computeManagedCycle();
    if (!m) return true;
    if (m.phase === "before_genesis") return true;
    return false;
  };

  if (looksBroken()) {
    console.warn("[cycle-clock] missing or invalid — pinning genesis to current window (same as cycle:clock-init)");
    state = initCycleClockState();
  }
  return /** @type {NonNullable<typeof state>} */ (state);
}

/** Drop legacy schedule fields from disk — schedule lives in `cycles.yaml` only (v2 = genesis only). */
function migrateCycleClockFileToGenesisOnly() {
  const p = cycleClockStatePath();
  if (!fs.existsSync(p)) return;
  let j;
  try {
    j = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return;
  }
  const allowed = new Set(["version", "genesisUnix", "updatedAt"]);
  const hasDisallowed = Object.keys(j).some((k) => !allowed.has(k));
  if (!hasDisallowed && j.version === 2) return;

  const genesisUnix = Number(j.genesisUnix);
  if (!Number.isFinite(genesisUnix)) return;

  fs.writeFileSync(
    p,
    JSON.stringify(
      {
        version: 2,
        genesisUnix,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

/**
 * Payload for frontend: enough to recompute phase client-side.
 */
export function getManagedClockExportPayload() {
  const s = loadCycleClockState();
  if (!s) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const live = computeManagedCycle(nowSec);
  return {
    genesisUnix: s.genesisUnix,
    durationSec: s.durationSec,
    votingSec: s.votingSec,
    frozenSec: s.frozenSec,
    serverNowSec: nowSec,
    live,
  };
}

/**
 * @param {import("./voteStore.mjs").NormalizedVoteStore} store
 * @param {{ index: number } | null} managed
 */
export function pickAggregationCycleKey(store, managed) {
  if (process.env.VOTE_CYCLE_KEY) return String(process.env.VOTE_CYCLE_KEY);
  if (managed && store.cycles[String(managed.index)] != null) return String(managed.index);
  return String(store.defaultCycleKey);
}
