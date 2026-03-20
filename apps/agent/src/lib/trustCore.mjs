/**
 * Shared trust v0 logic — CSV rows + scoring config → trustByVoter map (lowercase keys).
 */
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";

import { repoRoot } from "./env.mjs";

export function loadScoring() {
  const p = path.join(repoRoot, "config/trust/scoring.yaml");
  const doc = parseYaml(fs.readFileSync(p, "utf8"));
  const t = doc.trust;
  const pt = t.portfolio_trust ?? {};
  return {
    floor: Number(t.trust_floor ?? 0.1),
    ceiling: Number(t.trust_ceiling ?? 3),
    defaultTrust: Number(t.default_trust ?? 1),
    updateRule: t.update_rule ?? "relative_to_benchmark",
    portfolioTrust: {
      linearScale: Number(pt.linear_scale ?? 1),
    },
  };
}

/**
 * @param {{ fallbackToExample?: boolean }} [options]
 *   Default: do **not** use the fixture CSV — if `config/local/trust_cycle.csv` is missing, returns
 *   empty rows (every address uses default trust in the UI). The old example file only had fake
 *   addresses, so real wallets always showed 1.000 and looked "broken".
 */
export function loadCsv(options = {}) {
  const local = path.join(repoRoot, "config/local/trust_cycle.csv");
  const example = path.join(repoRoot, "apps/agent/fixtures/trust_cycle.example.csv");
  const useExample = options.fallbackToExample === true;
  if (!fs.existsSync(local)) {
    if (!useExample) {
      console.warn(
        "[trust] config/local/trust_cycle.csv is missing — no per-voter trust rows. " +
          "All wallets get default trust (1.0) until you run trust-finalize-window after a window closes.",
      );
      return { src: local, rows: [], missingLocalCsv: true };
    }
    const rawEx = fs.readFileSync(example, "utf8").trim();
    const lines = rawEx ? rawEx.split(/\r?\n/) : [];
    return { src: example, rows: parseCsvLines(lines), missingLocalCsv: false };
  }
  const rawLocal = fs.readFileSync(local, "utf8").trim();
  if (!rawLocal) {
    console.warn("[trust] config/local/trust_cycle.csv is empty — no trust rows.");
    return { src: local, rows: [], missingLocalCsv: false };
  }
  const lines = rawLocal.split(/\r?\n/);
  return { src: local, rows: parseCsvLines(lines), missingLocalCsv: false };
}

function parseCsvLines(lines) {
  if (lines.length === 0 || !lines[0]) return [];
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
  return rows;
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * @param {Record<string, string>[]} rows
 * @param {ReturnType<typeof loadScoring>} scoring
 */
/**
 * Apply one CSV row to a trust value (same semantics as buildTrustByVoter).
 * @param {number} t0
 * @param {{ vote_return_bps?: string | number; benchmark_return_bps?: string | number }} r
 * @param {ReturnType<typeof loadScoring>} scoring
 * @returns {number}
 */
export function applyTrustRow(t0, r, scoring) {
  let v = Number(r.vote_return_bps ?? 0);
  let b = Number(r.benchmark_return_bps ?? 0);
  if (!Number.isFinite(v)) v = 0;
  if (!Number.isFinite(b)) b = 0;
  let t = t0;
  if (scoring.updateRule === "time_weighted_portfolio_return") {
    const gain = v / 10000;
    const scale = scoring.portfolioTrust?.linearScale ?? 1;
    t *= 1 + scale * gain;
  } else if (scoring.updateRule === "relative_to_benchmark") {
    if (v >= b) t *= 1.05;
    else t *= 0.95;
  }
  return clamp(t, scoring.floor, scoring.ceiling);
}

export function buildTrustByVoter(rows, scoring) {
  const trust = {};
  for (const r of rows) {
    const voter = (r.voter_address ?? r.voter)?.toLowerCase();
    if (!voter) continue;
    const t0 = trust[voter] ?? scoring.defaultTrust;
    trust[voter] = applyTrustRow(t0, r, scoring);
  }
  return trust;
}

/**
 * Per-voter chronological history (sorted by cycle_id) with trust before/after each step.
 * @param {Record<string, string>[]} rows
 * @param {ReturnType<typeof loadScoring>} scoring
 * @returns {Record<string, Array<{ cycle_id: string; vote_return_bps: number; benchmark_return_bps: number; trust_before: number; trust_after: number; delta_trust: number }>>}
 */
export function buildPerVoterHistory(rows, scoring) {
  const byVoter = new Map();
  for (const r of rows) {
    const voter = (r.voter_address ?? r.voter)?.toLowerCase();
    if (!voter) continue;
    if (!byVoter.has(voter)) byVoter.set(voter, []);
    byVoter.get(voter).push(r);
  }
  for (const arr of byVoter.values()) {
    arr.sort((a, b) => Number(a.cycle_id) - Number(b.cycle_id));
  }
  const out = {};
  for (const [voter, list] of byVoter.entries()) {
    let t = scoring.defaultTrust;
    const cycles = [];
    for (const r of list) {
      const v = Number(r.vote_return_bps ?? 0);
      const b = Number(r.benchmark_return_bps ?? 0);
      const vb = Number.isFinite(v) ? v : 0;
      const bb = Number.isFinite(b) ? b : 0;
      const before = t;
      const after = applyTrustRow(before, r, scoring);
      cycles.push({
        cycle_id: String(r.cycle_id ?? ""),
        vote_return_bps: vb,
        benchmark_return_bps: bb,
        trust_before: before,
        trust_after: after,
        delta_trust: after - before,
      });
      t = after;
    }
    out[voter] = cycles;
  }
  return out;
}
