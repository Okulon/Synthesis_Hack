/**
 * Ensures vote-store has placeholder cycle entries for every integer key in [0, maxKey + horizon]
 * so trust-finalize / lookups never hit unknown cycle keys (gaps from clock jumps vs sparse sync).
 *
 * Env:
 *   VOTE_STORE_PREFILL_HORIZON — default 1000 (adds keys through maxNumericKey + horizon)
 *
 * Does not overwrite existing cycles; only inserts missing keys with empty ballots.
 */
import fs from "fs";

import { normalizeVoteStore, saveVoteStore, voteStoreLocalPath, voteStoreExamplePath } from "./lib/voteStore.mjs";

function maxNumericCycleKey(store) {
  let m = -1;
  for (const k of Object.keys(store.cycles)) {
    const n = Number(k);
    if (String(n) === k && Number.isFinite(n) && n >= 0) m = Math.max(m, n);
  }
  const d = Number(store.defaultCycleKey);
  if (String(d) === String(store.defaultCycleKey) && Number.isFinite(d) && d >= 0) m = Math.max(m, d);
  return m;
}

function placeholderEntry(key) {
  return {
    label: `Prefilled window ${key} (placeholder)`,
    onChainCycleId: key,
    votingOpen: false,
    snapshotBlock: null,
    snapshotCapturedAt: null,
    shares1e18: {},
    ballots: [],
  };
}

function main() {
  const horizon = Number(process.env.VOTE_STORE_PREFILL_HORIZON ?? "1000");
  if (!Number.isFinite(horizon) || horizon < 0) {
    console.error("Bad VOTE_STORE_PREFILL_HORIZON");
    process.exit(1);
  }

  const local = voteStoreLocalPath();
  const example = voteStoreExamplePath();
  const src = fs.existsSync(local) ? local : example;
  const raw = JSON.parse(fs.readFileSync(src, "utf8"));
  const store = normalizeVoteStore(raw);

  const maxK = maxNumericCycleKey(store);
  const end = maxK + horizon;
  let added = 0;
  for (let k = 0; k <= end; k++) {
    const key = String(k);
    if (!store.cycles[key]) {
      store.cycles[key] = placeholderEntry(k);
      added++;
    }
  }

  const dest = saveVoteStore(store);
  console.log(
    JSON.stringify(
      {
        ok: true,
        written: dest,
        maxNumericKey: maxK,
        horizon,
        rangeInclusive: [0, end],
        placeholdersAdded: added,
      },
      null,
      2,
    ),
  );
}

main();
