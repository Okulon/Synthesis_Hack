/**
 * Writes frontend/public/trust-scores.json from the same CSV + scoring.yaml as `npm run trust`.
 * Run from repo via: cd apps/agent && npm run trust:export
 */
import fs from "fs";
import path from "path";

import { repoRoot } from "./lib/env.mjs";
import { buildTrustByVoter, loadCsv, loadScoring } from "./lib/trustCore.mjs";

const scoring = loadScoring();
const { src, rows } = loadCsv();
const trustByVoter = buildTrustByVoter(rows, scoring);

const out = {
  trustByVoter,
  _meta: {
    csvSource: path.relative(repoRoot, src).replace(/\\/g, "/"),
    scoringRule: scoring.updateRule,
    updatedAt: new Date().toISOString(),
    note: "Regenerate: npm run trust:export (apps/agent)",
  },
};

const dest = path.join(repoRoot, "frontend/public/trust-scores.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(`Wrote ${path.relative(repoRoot, dest)} (${Object.keys(trustByVoter).length} voters)`);
