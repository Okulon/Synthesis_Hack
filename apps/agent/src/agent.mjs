/**
 * Single entry point: wall-clock cycles (cycle:sync auto-inits clock if missing/invalid), vote exports,
 * optional trust pipeline, aggregate → targets.json, optional auto-rebalance.
 *
 * From repo root: `npm run agent` or `pnpm run agent`
 * Or: `cd apps/agent && npm run agent`
 *
 * Env (all optional except standard .env for chain/vault when features are on):
 *   AGENT_INTERVAL_SEC — tick interval (default 60, or CYCLE_DAEMON_INTERVAL_SEC)
 *   AGENT_AGGREGATE_TARGETS — write config/local/targets.json from votes (default 1)
 *   AGENT_STAMP_PRICES — during voting: refresh ballot priceMarksUsdc (default 1, needs RPC)
 *   AGENT_STAMP_INTERVAL_SEC — min seconds between stamps (0 = every tick in voting)
 *   AGENT_TRUST_ON_ROLLOVER — on window index ↑: trust:finalize-window + trust + trust:export (default 1, needs RPC)
 *   AGENT_TRUST_EXPORT — also run trust:export every tick (default 1; rollover path already exports when trust runs)
 *   AGENT_AUTO_REBALANCE — legacy: if 1, at most one plan→rebalance per tick (default 0). Prefer AGENT_REBALANCE_TO_TARGET.
 *   AGENT_REBALANCE_TO_TARGET — default: on if EXECUTOR_PRIVATE_KEY. Each tick: loop plan → rebalance while `would_trade`
 *     or until AGENT_REBALANCE_MAX_STEPS_PER_TICK (default 8). Set 0 to disable.
 *   AGENT_REBALANCE_FROZEN_PHASE_ONLY — if 1, only run that loop during wall-clock "frozen" (skip during voting).
 *   AGENT_CLOSE_CYCLE_ON_ROLLOVER — default: on if GOVERNANCE_PRIVATE_KEY set, else off; set 0 to force off.
 *     Calls DAOVault.closeCycle first on rollover; lastManagedIndex is NOT advanced if this fails (retries next tick).
 *   AGENT_REBALANCE_ON_ROLLOVER — if AGENT_REBALANCE_TO_TARGET is off: one `rebalance.mjs` per rollover. Set 0 to disable.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { computeManagedCycle } from "./lib/cycleClock.mjs";
import { repoRoot } from "./lib/env.mjs";

const agentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runScript(relPath, extraEnv = {}) {
  const scriptPath = path.join(agentRoot, relPath);
  return spawnSync(process.execPath, [scriptPath], {
    cwd: agentRoot,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

function runScriptCapture(relPath) {
  return spawnSync(process.execPath, [path.join(agentRoot, relPath)], {
    cwd: agentRoot,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function statePath() {
  return path.join(repoRoot, "config/local/agent-runtime-state.json");
}

function loadState() {
  const p = statePath();
  if (!fs.existsSync(p)) {
    return { lastManagedIndex: null, lastStampAt: null };
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function saveState(s) {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(s, null, 2));
}

function envBool(name, defaultVal) {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultVal;
  return v !== "0" && v !== "false" && v !== "no";
}

/** When unset: close on rollover iff GOVERNANCE_PRIVATE_KEY is set. Force off with AGENT_CLOSE_CYCLE_ON_ROLLOVER=0. */
function envCloseCycleOnRollover() {
  const v = process.env.AGENT_CLOSE_CYCLE_ON_ROLLOVER;
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return !!process.env.GOVERNANCE_PRIVATE_KEY;
}

/** When unset: one rebalance tx per rollover iff EXECUTOR_PRIVATE_KEY set. Force off with AGENT_REBALANCE_ON_ROLLOVER=0. */
function envRebalanceOnRollover() {
  const v = process.env.AGENT_REBALANCE_ON_ROLLOVER;
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return !!process.env.EXECUTOR_PRIVATE_KEY;
}

/** Ongoing plan→rebalance loop until within bands (per tick cap). Default on if EXECUTOR_PRIVATE_KEY. */
function envRebalanceTowardTarget() {
  const v = process.env.AGENT_REBALANCE_TO_TARGET;
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return !!process.env.EXECUTOR_PRIVATE_KEY;
}

function envRebalanceFrozenPhaseOnly() {
  return envBool("AGENT_REBALANCE_FROZEN_PHASE_ONLY", false);
}

/**
 * @returns {boolean} false = must retry (closeCycle was required and failed or misconfigured)
 */
function runCloseCycleIfEnabled() {
  if (!envCloseCycleOnRollover()) return true;
  if (!process.env.GOVERNANCE_PRIVATE_KEY) {
    console.error(
      "[agent] closeCycle is ON but GOVERNANCE_PRIVATE_KEY is missing — cannot advance on-chain cycleId; set key or AGENT_CLOSE_CYCLE_ON_ROLLOVER=0",
    );
    return false;
  }
  if (!process.env.CHAIN_RPC_URL || !process.env.VAULT_ADDRESS) {
    console.error("[agent] closeCycle needs CHAIN_RPC_URL + VAULT_ADDRESS");
    return false;
  }
  console.log("[agent] closeCycle (on-chain period)…");
  const r = runScript("src/close-cycle.mjs");
  if (r.status !== 0) {
    console.error("[agent] close-cycle failed — fix error; will retry next tick (wall-clock not advanced in store)");
    return false;
  }
  return true;
}

function runTrustPipelineForClosedWindow(prevKey) {
  if (!envBool("AGENT_TRUST_ON_ROLLOVER", true)) return;
  if (!process.env.CHAIN_RPC_URL) {
    console.warn("[agent] trust finalize skipped — no CHAIN_RPC_URL");
    return;
  }
  console.log(`[agent] trust finalize for vote-store window ${prevKey}…`);
  let r = runScript("src/trust-finalize-window.mjs", { TRUST_FINALIZE_CYCLE_KEY: String(prevKey) });
  if (r.status !== 0) console.error("[agent] trust-finalize-window exit", r.status);
  r = runScript("src/trust.mjs");
  if (r.status !== 0) console.error("[agent] trust exit", r.status);
  r = runScript("src/trust-export-frontend.mjs");
  if (r.status !== 0) console.error("[agent] trust:export exit", r.status);
}

function runRebalanceNudgeOnRollover() {
  if (!envRebalanceOnRollover()) return;
  if (!process.env.EXECUTOR_PRIVATE_KEY) {
    console.warn("[agent] rebalance on rollover: set EXECUTOR_PRIVATE_KEY or AGENT_REBALANCE_ON_ROLLOVER=0");
    return;
  }
  if (!process.env.CHAIN_RPC_URL || !process.env.VAULT_ADDRESS) {
    console.warn("[agent] rebalance on rollover skipped — CHAIN_RPC_URL / VAULT_ADDRESS");
    return;
  }
  console.log("[agent] rebalance (rollover nudge — set REBALANCE_BPS)…");
  const r = runScript("src/rebalance.mjs");
  if (r.status !== 0) console.error("[agent] rebalance exit", r.status);
}

function maybeAggregateTargets() {
  if (!envBool("AGENT_AGGREGATE_TARGETS", true)) return;
  const r = runScriptCapture("src/aggregate.mjs");
  if (r.status !== 0) {
    console.error("[agent] aggregate failed:", r.stderr?.slice(0, 500) || r.status);
    return;
  }
  try {
    const j = JSON.parse(r.stdout.trim());
    if (!j.targets || typeof j.targets !== "object") throw new Error("no targets in aggregate output");
    const dest = path.join(repoRoot, "config/local/targets.json");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const payload = {
      cycleId: j.onChainCycleId ?? j.cycleId ?? 0,
      targets: j.targets,
      _meta: {
        writtenBy: "agent",
        at: new Date().toISOString(),
        aggregationMode: j.aggregationMode,
        cycleKey: j.cycleKey,
      },
    };
    fs.writeFileSync(dest, JSON.stringify(payload, null, 2));
    console.log(`[agent] wrote ${path.relative(repoRoot, dest)}`);
  } catch (e) {
    console.error("[agent] aggregate → targets.json:", e.message);
  }
}

function handleWindowRoll(managed, state) {
  if (state.lastManagedIndex != null && managed.index < state.lastManagedIndex) {
    console.log("[agent] managed index regressed (cycle clock was re-init) — reset rollout cursor");
    state = { ...state, lastManagedIndex: null, lastStampAt: null };
  }
  if (state.lastManagedIndex == null) {
    return { ...state, lastManagedIndex: managed.index };
  }
  if (managed.index <= state.lastManagedIndex) {
    return state;
  }

  let s = { ...state };
  /** Catch up multiple wall-clock windows in one tick if the agent was down. */
  while (managed.index > s.lastManagedIndex) {
    const prev = s.lastManagedIndex;
    console.log(`[agent] wall-clock closed window ${prev} (live index ${managed.index})…`);

    if (!runCloseCycleIfEnabled()) {
      break;
    }

    runTrustPipelineForClosedWindow(prev);
    if (!envRebalanceTowardTarget()) {
      runRebalanceNudgeOnRollover();
    }

    s = { ...s, lastManagedIndex: prev + 1, lastStampAt: null };
  }

  return s;
}

function maybeStampPrices(managed, state) {
  if (!envBool("AGENT_STAMP_PRICES", true)) return state;
  if (managed.phase !== "voting") return state;
  if (!process.env.CHAIN_RPC_URL) {
    console.warn("[agent] AGENT_STAMP_PRICES on but CHAIN_RPC_URL missing — skip stamp");
    return state;
  }

  const minSec = Number(process.env.AGENT_STAMP_INTERVAL_SEC ?? "0");
  const now = Date.now();
  if (minSec > 0 && state.lastStampAt && now - state.lastStampAt < minSec * 1000) {
    return state;
  }

  console.log("[agent] trust:stamp-prices (voting phase)…");
  const r = runScript("src/trust-stamp-prices.mjs");
  if (r.status !== 0) console.error("[agent] trust-stamp-prices exit", r.status);
  return { ...state, lastStampAt: now };
}

/**
 * Repeatedly `plan` → `rebalance` until no asset is `would_trade` or step cap (continues across ticks).
 * MVP: `rebalance.mjs` only moves WETH→USDC; multi-asset targets may converge slowly or stall — see bands.yaml + REBALANCE_BPS.
 */
function maybeRebalanceTowardTargets(managed) {
  const toward = envRebalanceTowardTarget();
  const legacyOneShot = envBool("AGENT_AUTO_REBALANCE", false);
  if (!toward && !legacyOneShot) return;

  if (!process.env.EXECUTOR_PRIVATE_KEY) {
    console.warn("[agent] rebalance: EXECUTOR_PRIVATE_KEY unset — skip");
    return;
  }
  if (!process.env.CHAIN_RPC_URL || !process.env.VAULT_ADDRESS) {
    console.warn("[agent] rebalance needs CHAIN_RPC_URL + VAULT_ADDRESS");
    return;
  }

  if (toward && envRebalanceFrozenPhaseOnly() && managed.phase === "voting") {
    return;
  }

  const maxSteps = toward
    ? Math.max(1, Math.min(30, Number(process.env.AGENT_REBALANCE_MAX_STEPS_PER_TICK ?? "8")))
    : 1;

  for (let step = 0; step < maxSteps; step++) {
    const cap = runScriptCapture("src/cli.mjs");
    if (cap.status !== 0) {
      console.error("[agent] plan (cli) failed", cap.status);
      break;
    }
    let plan;
    try {
      plan = JSON.parse(cap.stdout.trim());
    } catch {
      console.error("[agent] plan JSON parse failed");
      break;
    }
    const anyTrade = plan.rows?.some((row) => row.decision === "would_trade");
    if (!anyTrade) {
      if (step === 0) console.log("[agent] rebalance converge: within bands (no would_trade)");
      else console.log(`[agent] rebalance converge: within bands after ${step} tx step(s) this tick`);
      break;
    }
    console.log(`[agent] rebalance converge ${step + 1}/${maxSteps} — would_trade…`);
    const rb = runScript("src/rebalance.mjs");
    if (rb.status !== 0) {
      console.error("[agent] rebalance exit", rb.status);
      break;
    }
  }
}

function tick() {
  console.log(`\n[agent] tick ${new Date().toISOString()}`);

  let r = runScript("src/cycle-sync.mjs");
  if (r.status !== 0) console.error("[agent] cycle-sync exit", r.status);

  const managed = computeManagedCycle();
  if (!managed || managed.phase === "before_genesis") {
    console.error("[agent] no valid managed cycle after cycle:sync — check config/agent/cycles.yaml");
    return;
  }

  let state = loadState();
  state = handleWindowRoll(managed, state);
  saveState(state);

  state = loadState();
  state = maybeStampPrices(managed, state);
  saveState(state);

  maybeAggregateTargets();

  r = runScript("src/votes-export-frontend.mjs", { AGENT_SKIP_VOTES_EXPORT_SYNC: "1" });
  if (r.status !== 0) console.error("[agent] votes:export exit", r.status);

  if (envBool("AGENT_TRUST_EXPORT", true)) {
    r = runScript("src/trust-export-frontend.mjs");
    if (r.status !== 0) console.error("[agent] trust:export exit", r.status);
  }

  maybeRebalanceTowardTargets(managed);
}

const intervalSec = Math.max(10, Number(process.env.AGENT_INTERVAL_SEC ?? process.env.CYCLE_DAEMON_INTERVAL_SEC ?? 60));

console.log(`[agent] started · interval ${intervalSec}s
  aggregate→targets: ${envBool("AGENT_AGGREGATE_TARGETS", true) ? "on" : "off"}
  stamp prices (voting): ${envBool("AGENT_STAMP_PRICES", true) ? "on" : "off"}
  trust on rollover: ${envBool("AGENT_TRUST_ON_ROLLOVER", true) ? "on" : "off"}
  trust export every tick: ${envBool("AGENT_TRUST_EXPORT", true) ? "on" : "off"}
  rebalance→target loop: ${envRebalanceTowardTarget() ? `on (max ${Number(process.env.AGENT_REBALANCE_MAX_STEPS_PER_TICK ?? "8")}/tick${envRebalanceFrozenPhaseOnly() ? ", frozen phase only" : ""})` : "off"}
  legacy AGENT_AUTO_REBALANCE (1 step): ${envBool("AGENT_AUTO_REBALANCE", false) ? "on" : "off"}
  closeCycle on rollover: ${envCloseCycleOnRollover() ? "on (gov tx)" : "off"}
  rebalance nudge on rollover: ${!envRebalanceTowardTarget() && envRebalanceOnRollover() ? "on" : "off"}`);

tick();
const id = setInterval(tick, intervalSec * 1000);

process.on("SIGINT", () => {
  clearInterval(id);
  console.log("\n[agent] stopped (SIGINT)");
  process.exit(0);
});
