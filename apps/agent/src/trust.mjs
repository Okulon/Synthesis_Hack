/**
 * Trust v0 — read cycle CSV + scoring.yaml; apply simple relative_to_benchmark rule; output JSON lines.
 * CSV columns: cycle_id,voter_address,vote_return_bps,benchmark_return_bps
 */
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";

import { repoRoot } from "./lib/env.mjs";

function loadScoring() {
  const p = path.join(repoRoot, "config/trust/scoring.yaml");
  const doc = parseYaml(fs.readFileSync(p, "utf8"));
  const t = doc.trust;
  return {
    floor: Number(t.trust_floor ?? 0.1),
    ceiling: Number(t.trust_ceiling ?? 3),
    defaultTrust: Number(t.default_trust ?? 1),
    updateRule: t.update_rule ?? "relative_to_benchmark",
  };
}

function loadCsv() {
  const local = path.join(repoRoot, "config/local/trust_cycle.csv");
  const example = path.join(repoRoot, "apps/agent/fixtures/trust_cycle.example.csv");
  const src = fs.existsSync(local) ? local : example;
  const lines = fs.readFileSync(src, "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",").map((s) => s.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const o = {};
    header.forEach((h, j) => {
      o[h] = parts[j]?.trim();
    });
    rows.push(o);
  }
  return { src, rows };
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

async function main() {
  const scoring = loadScoring();
  const { src, rows } = loadCsv();
  const trust = {};

  for (const r of rows) {
    const voter = (r.voter_address ?? r.voter)?.toLowerCase();
    if (!voter) continue;
    const v = Number(r.vote_return_bps ?? 0);
    const b = Number(r.benchmark_return_bps ?? 0);
    let t0 = trust[voter] ?? scoring.defaultTrust;
    if (scoring.updateRule === "relative_to_benchmark") {
      if (v >= b) t0 *= 1.05;
      else t0 *= 0.95;
    }
    trust[voter] = clamp(t0, scoring.floor, scoring.ceiling);
  }

  console.log(
    JSON.stringify(
      {
        source: src,
        scoring: scoring.updateRule,
        trustByVoter: trust,
        note: "Use trust as multiplier in aggregate votes (see aggregate.mjs).",
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
