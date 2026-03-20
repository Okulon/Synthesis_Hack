/**
 * Trust v0 — read cycle CSV + scoring.yaml; apply simple relative_to_benchmark rule; output JSON lines.
 * CSV columns: cycle_id,voter_address,vote_return_bps,benchmark_return_bps
 */
import { buildTrustByVoter, loadCsv, loadScoring } from "./lib/trustCore.mjs";

async function main() {
  const scoring = loadScoring();
  const { src, rows } = loadCsv();
  const trustByVoter = buildTrustByVoter(rows, scoring);

  console.log(
    JSON.stringify(
      {
        source: src,
        scoring: scoring.updateRule,
        trustByVoter,
        note: "Use trust as multiplier in aggregate votes (see aggregate.mjs).",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
