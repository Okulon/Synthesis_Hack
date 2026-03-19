/**
 * Aggregate allocation votes from JSON → normalized target weights (trust × weight, then normalize).
 * Input: config/local/votes.json or apps/agent/fixtures/votes.example.json
 */
import fs from "fs";
import path from "path";

import { repoRoot } from "./lib/env.mjs";

function loadVotes() {
  const local = path.join(repoRoot, "config/local/votes.json");
  const example = path.join(repoRoot, "apps/agent/fixtures/votes.example.json");
  const src = fs.existsSync(local) ? local : example;
  const j = JSON.parse(fs.readFileSync(src, "utf8"));
  return { src, cycleId: j.cycleId ?? 0, voters: j.voters ?? [] };
}

function aggregate(voters) {
  const acc = {};
  let tw = 0;
  for (const v of voters) {
    const t = Number(v.trust ?? 1);
    if (t <= 0) continue;
    tw += t;
    const w = v.weights ?? {};
    for (const [addr, wt] of Object.entries(w)) {
      const k = addr.toLowerCase();
      acc[k] = (acc[k] ?? 0) + t * Number(wt);
    }
  }
  const sum = Object.values(acc).reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error("no positive aggregated weights");
  const targets = {};
  for (const [k, v] of Object.entries(acc)) {
    targets[k] = v / sum;
  }
  return { targets, rawSum: sum };
}

async function main() {
  const { src, cycleId, voters } = loadVotes();
  const { targets } = aggregate(voters);
  console.log(JSON.stringify({ source: src, cycleId, voterCount: voters.length, targets }, null, 2));
  console.error(
    "\nTip: copy aggregated `targets` into config/local/targets.json for `npm run plan` (or pipe via script)."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
