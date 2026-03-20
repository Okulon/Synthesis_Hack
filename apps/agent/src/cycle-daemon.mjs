/**
 * Long-running process: keeps wall-clock cycles aligned and dashboard JSON fresh.
 *
 * - Each tick runs `cycle:sync`, which auto-inits wall-clock if missing/invalid (same as `cycle:clock-init`).
 * - Every `CYCLE_DAEMON_INTERVAL_SEC` (default 60): `cycle:sync` → `votes:export` (optional `trust:export`).
 *
 * Run from repo: `cd apps/agent && npm run cycle:daemon`
 * Production: systemd, pm2, or `nohup … &` — needs repo root `.env` loaded via agent’s `env.mjs`.
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

import "./lib/env.mjs";

const agentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runScript(relPath, extraEnv = {}) {
  const scriptPath = path.join(agentRoot, relPath);
  return spawnSync(process.execPath, [scriptPath], {
    cwd: agentRoot,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

function tick() {
  console.log(`\n[cycle-daemon] tick ${new Date().toISOString()}`);
  let r = runScript("src/cycle-sync.mjs");
  if (r.status !== 0) console.error("[cycle-daemon] cycle:sync exit", r.status);
  r = runScript("src/votes-export-frontend.mjs", { AGENT_SKIP_VOTES_EXPORT_SYNC: "1" });
  if (r.status !== 0) console.error("[cycle-daemon] votes:export exit", r.status);
  if (process.env.CYCLE_DAEMON_TRUST_EXPORT === "1") {
    r = runScript("src/trust-export-frontend.mjs");
    if (r.status !== 0) console.error("[cycle-daemon] trust:export exit", r.status);
  }
}

const intervalSec = Math.max(10, Number(process.env.CYCLE_DAEMON_INTERVAL_SEC ?? 60));

console.log(
  `[cycle-daemon] starting — interval ${intervalSec}s · trust export: ${process.env.CYCLE_DAEMON_TRUST_EXPORT === "1" ? "on" : "off"}`
);

tick();
const id = setInterval(tick, intervalSec * 1000);

process.on("SIGINT", () => {
  clearInterval(id);
  console.log("\n[cycle-daemon] stopped (SIGINT)");
  process.exit(0);
});
