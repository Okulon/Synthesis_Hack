/**
 * Print managed wall-clock cycle + vote-store default key hint.
 */
import { computeManagedCycle, getManagedClockExportPayload, loadCycleClockState } from "./lib/cycleClock.mjs";
import fs from "fs";

import { loadVoteStore, voteStoreLocalPath } from "./lib/voteStore.mjs";

const clock = loadCycleClockState();
const payload = getManagedClockExportPayload();
const live = computeManagedCycle();
const localStore = fs.existsSync(voteStoreLocalPath()) ? loadVoteStore() : null;

console.log(
  JSON.stringify(
    {
      clockInitialized: clock != null,
      exportPayload: payload,
      live,
      voteStorePath: localStore ? localStore.path : null,
      voteStoreDefaultKey: localStore?.store.defaultCycleKey ?? null,
    },
    null,
    2
  )
);
