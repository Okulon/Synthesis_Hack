/**
 * Trust v0 — read cycle CSV + scoring.yaml; apply update rule; output JSON.
 * CSV columns: cycle_id,voter_address,vote_return_bps,benchmark_return_bps
 * Rules: relative_to_benchmark | time_weighted_portfolio_return (see config/trust/scoring.yaml)
 */
import { buildTrustByVoter, loadCsv, loadScoring } from "./lib/trustCore.mjs";

function printTrustSummary(trustByVoter, scoring, missingLocalCsv) {
  const def = scoring.defaultTrust;
  console.error("\n[trust] scores (stderr — stdout above is JSON for scripts):");
  const addrs = Object.keys(trustByVoter).sort();
  if (addrs.length === 0) {
    if (missingLocalCsv) {
      console.error(
        "  config/local/trust_cycle.csv is MISSING — UI shows default 1.0 for every wallet (not computed trust).",
      );
    } else {
      console.error(
        "  CSV has no data rows — run trust-finalize-window after a window closes (ballots need priceMarksUsdc).",
      );
    }
    return;
  }
  let anyMoved = false;
  for (const addr of addrs) {
    const t = trustByVoter[addr];
    const delta = t - def;
    if (Math.abs(delta) > 1e-6) anyMoved = true;
    const sign = delta >= 0 ? "+" : "";
    console.error(`  ${addr}  →  ${t.toFixed(4)}  (${sign}${delta.toFixed(4)} vs default ${def})`);
  }
  if (!anyMoved) {
    console.error(
      "[trust] all scores still equal default — usually vote_return_bps rounded to 0 every cycle. " +
        "Set TESTBOOSTTRUST in repo .env (e.g. 100000) so finalize writes non-zero bps, or finalize after real P&L.",
    );
  }
  console.error(
    "[trust] Any wallet address NOT listed above still shows 1.0 in the UI (trustForAddress default). " +
      "If that’s you, your voter isn’t in trust_cycle.csv — wrong finalize cycle, skipped ballot, or only fixture rows.",
  );
}

async function main() {
  const scoring = loadScoring();
  const { src, rows, missingLocalCsv } = loadCsv();
  const trustByVoter = buildTrustByVoter(rows, scoring);

  console.log(
    JSON.stringify(
      {
        source: src,
        scoring: scoring.updateRule,
        defaultTrust: scoring.defaultTrust,
        missingLocalCsv: !!missingLocalCsv,
        csvRowCount: rows.length,
        trustByVoter,
        note: "Use trust as multiplier in aggregate votes (see aggregate.mjs).",
      },
      null,
      2,
    ),
  );
  printTrustSummary(trustByVoter, scoring, !!missingLocalCsv);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
