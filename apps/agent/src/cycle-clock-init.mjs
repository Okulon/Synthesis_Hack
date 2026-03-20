/**
 * Pin wall-clock genesis (start of current window per `config/agent/cycles.yaml`). Writes `cycle-clock.json` (genesis only).
 */
import path from "path";

import { initCycleClockState } from "./lib/cycleClock.mjs";
import { repoRoot } from "./lib/env.mjs";

const state = initCycleClockState();
console.log(
  JSON.stringify(
    {
      ok: true,
      path: path.relative(repoRoot, path.join(repoRoot, "config/local/cycle-clock.json")),
      ...state,
      nextStep: "npm run cycle:sync — align vote-store to current window; then npm run votes:export",
    },
    null,
    2
  )
);
