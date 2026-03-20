import { buildTrustByVoter, loadCsv, loadScoring } from "./trustCore.mjs";

/** @returns {Record<string, number>} lowercase voter → trust */
export function loadTrustByVoterMap() {
  const scoring = loadScoring();
  const { rows } = loadCsv();
  return buildTrustByVoter(rows, scoring);
}

export function loadTrustDefaults() {
  return loadScoring();
}
