/**
 * Cycle-keyed allocation vote store (gitignored local or repo fixture).
 */
import fs from "fs";
import path from "path";

import { repoRoot } from "./env.mjs";

export function voteStoreLocalPath() {
  return path.join(repoRoot, "config/local/vote-store.json");
}

export function voteStoreExamplePath() {
  return path.join(repoRoot, "apps/agent/fixtures/vote-store.example.json");
}

/**
 * @returns {{ path: string, store: NormalizedVoteStore }}
 */
export function loadVoteStore() {
  const local = voteStoreLocalPath();
  const example = voteStoreExamplePath();
  const src = fs.existsSync(local) ? local : example;
  const raw = fs.readFileSync(src, "utf8");
  const j = JSON.parse(raw);
  return { path: src, store: normalizeVoteStore(j) };
}

/** @param {NormalizedVoteStore} store */
export function saveVoteStore(store) {
  const dest = voteStoreLocalPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(store, null, 2));
  return dest;
}

/**
 * @typedef {Object} Ballot
 * @property {string} voter
 * @property {Record<string, number>} weights
 * @property {string} [submittedAt]
 */

/**
 * @typedef {Object} CycleEntry
 * @property {number} onChainCycleId
 * @property {boolean} votingOpen
 * @property {string | null} snapshotBlock
 * @property {Record<string, string>} shares1e18
 * @property {Ballot[]} ballots
 */

/**
 * @typedef {Object} NormalizedVoteStore
 * @property {number} version
 * @property {string} defaultCycleKey
 * @property {Record<string, CycleEntry>} cycles
 */

/** @param {any} j */
export function normalizeVoteStore(j) {
  const version = j.version ?? 1;
  const defaultCycleKey = String(j.defaultCycleKey ?? j.defaultAggregationCycleKey ?? j.currentVotingCycleId ?? "1");
  const cycles = {};
  const raw = j.cycles ?? {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k);
    const ballots = Array.isArray(v.ballots) ? v.ballots.map(normalizeBallot) : [];
    cycles[key] = {
      onChainCycleId: Number(v.onChainCycleId ?? key),
      votingOpen: v.votingOpen !== false,
      snapshotBlock: v.snapshotBlock != null ? String(v.snapshotBlock) : null,
      snapshotCapturedAt: v.snapshotCapturedAt ?? null,
      shares1e18: normalizeShares(v.shares1e18),
      ballots,
      label: v.label ?? null,
    };
  }
  return { version, defaultCycleKey, cycles };
}

function normalizeShares(s) {
  const out = {};
  if (!s || typeof s !== "object") return out;
  for (const [addr, val] of Object.entries(s)) {
    out[addr.toLowerCase()] = String(val);
  }
  return out;
}

/** @param {any} b */
function normalizeBallot(b) {
  const voter = (b.voter ?? b.address ?? "").toLowerCase();
  const weights = {};
  const w = b.weights ?? {};
  for (const [addr, wt] of Object.entries(w)) {
    weights[addr.toLowerCase()] = Number(wt);
  }
  return {
    voter,
    weights,
    submittedAt: b.submittedAt ?? null,
  };
}

/**
 * @param {string} cycleKey
 * @param {NormalizedVoteStore} store
 */
export function getCycle(store, cycleKey) {
  const c = store.cycles[String(cycleKey)];
  if (!c) throw new Error(`vote-store: unknown cycle key "${cycleKey}"`);
  return c;
}
