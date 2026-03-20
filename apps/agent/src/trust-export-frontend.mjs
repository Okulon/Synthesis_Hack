/**
 * Writes frontend/public/trust-scores.json from the same CSV + scoring.yaml as `npm run trust`.
 * Run from repo via: cd apps/agent && npm run trust:export
 */
import fs from "fs";
import path from "path";

import { repoRoot } from "./lib/env.mjs";
import { buildTrustByVoter, loadCsv, loadScoring } from "./lib/trustCore.mjs";
import { loadVoteStore } from "./lib/voteStore.mjs";

/** Ballot voters in vote-store who have no row in trust-scores yet (off-chain path). */
function ballotVotersNotInTrustMap(trustByVoter, store) {
  const keys = new Set(Object.keys(trustByVoter).map((k) => k.toLowerCase()));
  const seen = new Set();
  const pending = [];
  for (const c of Object.values(store.cycles ?? {})) {
    for (const b of c.ballots ?? []) {
      const v = (b.voter ?? "").toLowerCase();
      if (v && !keys.has(v) && !seen.has(v)) {
        seen.add(v);
        pending.push(v);
      }
    }
  }
  return pending.sort();
}

const scoring = loadScoring();
const { src, rows, missingLocalCsv } = loadCsv();
const trustByVoter = buildTrustByVoter(rows, scoring);

const { store: voteStore } = loadVoteStore();
const votersPendingTrustFinalize = ballotVotersNotInTrustMap(trustByVoter, voteStore);

const out = {
  trustByVoter,
  _meta: {
    csvSource: path.relative(repoRoot, src).replace(/\\/g, "/"),
    scoringRule: scoring.updateRule,
    csvRowCount: rows.length,
    missingLocalCsv: !!missingLocalCsv,
    votersPendingTrustFinalize,
    updatedAt: new Date().toISOString(),
    note: "Regenerate: npm run trust:export (apps/agent). votersPendingTrustFinalize = vote-store ballots not yet in trust_cycle.csv.",
  },
};

const dest = path.join(repoRoot, "frontend/public/trust-scores.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(`Wrote ${path.relative(repoRoot, dest)} (${Object.keys(trustByVoter).length} voters)`);
