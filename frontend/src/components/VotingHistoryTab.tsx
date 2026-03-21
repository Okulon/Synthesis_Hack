import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import {
  fetchTrustHistory,
  formatBpsAsPercent,
  type TrustHistoryPayload,
  type TrustHistoryStep,
} from "../lib/trustHistory";
import { fetchCycleProfits, type CycleProfitRow } from "../lib/cycleProfits";
import { explorerBase } from "../lib/client";
import { shortAddr, type VaultSnapshot } from "../lib/vault";
import { pctFromFraction } from "../lib/allocationVotes";

type HistoryChartMode = "trust" | "profits" | "balance";

function profitCycleForTrustStep(cycles: CycleProfitRow[], cycleId: string): CycleProfitRow | undefined {
  return cycles.find(
    (c) =>
      (c.voteStoreCycleKey != null && String(c.voteStoreCycleKey) === cycleId) ||
      (c.wallClockIndex != null && String(c.wallClockIndex) === cycleId),
  );
}

function allocationForVoter(cycle: CycleProfitRow | undefined, voterLc: string): bigint {
  if (!cycle) return 0n;
  const p = cycle.participants.find((x) => x.address.toLowerCase() === voterLc);
  if (!p?.allocation1e18) return 0n;
  try {
    return BigInt(p.allocation1e18);
  } catch {
    return 0n;
  }
}

function nav1e18ToNumber(n: bigint): number {
  return Number(n) / 1e18;
}

function assetSymbolForAddress(snap: VaultSnapshot, addr: string): string {
  const key = addr.toLowerCase();
  const tracked = snap.assets.find((x) => x.address.toLowerCase() === key);
  if (tracked?.symbol) return tracked.symbol;
  const ballot = snap.ballotAssets.find((x) => x.address.toLowerCase() === key);
  return ballot?.symbol ?? shortAddr(addr, 5);
}

type ChartPoint = { x: number; y: number; label: string };

function HistoryLineChart({
  points,
  yMin,
  yMax,
  formatYTick,
  stroke,
  gradientId,
  caption,
  emptyHint,
}: {
  points: ChartPoint[];
  yMin: number;
  yMax: number;
  formatYTick: (v: number) => string;
  stroke: string;
  gradientId: string;
  caption: string;
  emptyHint?: string;
}) {
  const padL = 52;
  const padR = 16;
  const padT = 12;
  const W = 560;
  const H = 200;
  const innerW = W - padL - padR;
  const innerH = H - padT - 36;

  if (points.length === 0) {
    return <p className="muted small">{emptyHint ?? "No data points."}</p>;
  }

  const pathD =
    points.length > 0
      ? `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}`
      : "";

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  return (
    <div className="trust-chart-wrap">
      <svg className="trust-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.9" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="none" stroke="#444" strokeWidth="1" opacity="0.5" />
        {yTicks.map((yt, i) => {
          const yn = (yt - yMin) / (yMax - yMin || 1);
          const y = padT + innerH * (1 - yn);
          return (
            <g key={i}>
              <line x1={padL} x2={padL + innerW} y1={y} y2={y} stroke="#555" strokeDasharray="4 4" opacity="0.4" />
              <text x={padL - 6} y={y + 4} textAnchor="end" className="trust-chart-tick" fontSize="10">
                {formatYTick(yt)}
              </text>
            </g>
          );
        })}
        {pathD ? (
          <>
            <path d={pathD} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="5" fill="#14121a" stroke={stroke} strokeWidth="2" />
            ))}
          </>
        ) : null}
        {points.map((p, i) => (
          <text key={`l-${i}`} x={p.x} y={H - 8} textAnchor="middle" className="trust-chart-label" fontSize="11">
            #{p.label}
          </text>
        ))}
      </svg>
      <p className="muted small trust-chart-caption">{caption}</p>
    </div>
  );
}

function buildTrustChartSeries(
  steps: TrustHistoryStep[],
  defaultTrust: number,
  floor: number,
  ceiling: number,
): { points: ChartPoint[]; yMin: number; yMax: number } {
  const padL = 52;
  const padR = 16;
  const padT = 12;
  const W = 560;
  const innerW = W - padL - padR;
  const innerH = 200 - padT - 36;
  if (steps.length === 0) return { points: [], yMin: 0, yMax: 1 };
  const vals = [defaultTrust, ...steps.map((s) => s.trust_after), ...steps.map((s) => s.trust_before)];
  let yMin = Math.min(floor, ...vals);
  let yMax = Math.max(ceiling, ...vals);
  if (yMax - yMin < 0.05) {
    yMin -= 0.05;
    yMax += 0.05;
  }
  const n = steps.length;
  const points = steps.map((s, i) => {
    const x = n === 1 ? padL + innerW / 2 : padL + (innerW * i) / Math.max(1, n - 1);
    const t = s.trust_after;
    const yn = (t - yMin) / (yMax - yMin || 1);
    const y = padT + innerH * (1 - yn);
    return { x, y, label: s.cycle_id };
  });
  return { points, yMin, yMax };
}

function buildProfitChartSeries(
  steps: TrustHistoryStep[],
  cycles: CycleProfitRow[],
  voterLc: string,
): { points: ChartPoint[]; yMin: number; yMax: number } {
  const padL = 52;
  const padR = 16;
  const padT = 12;
  const W = 560;
  const innerW = W - padL - padR;
  const innerH = 200 - padT - 36;
  const ys: number[] = [];
  const n = steps.length;
  const raw = steps.map((s, i) => {
    const c = profitCycleForTrustStep(cycles, s.cycle_id);
    const alloc = allocationForVoter(c, voterLc);
    const yv = nav1e18ToNumber(alloc);
    ys.push(yv);
    const x = n === 1 ? padL + innerW / 2 : padL + (innerW * i) / Math.max(1, n - 1);
    return { x, y: yv, label: s.cycle_id, yv };
  });
  let yMin = Math.min(0, ...ys);
  let yMax = Math.max(1e-9, ...ys);
  if (yMax - yMin < 1e-12) {
    yMax = yMin + 1e-6;
  } else if (yMax - yMin < (yMax + yMin) * 0.05) {
    const pad = (yMax - yMin) * 0.1 || 0.01;
    yMin -= pad;
    yMax += pad;
  }
  const points = raw.map((r) => {
    const yn = (r.yv - yMin) / (yMax - yMin || 1);
    const y = padT + innerH * (1 - yn);
    return { x: r.x, y, label: r.label };
  });
  return { points, yMin, yMax };
}

function buildBalanceChartSeries(
  steps: TrustHistoryStep[],
  cycles: CycleProfitRow[],
  voterLc: string,
): { points: ChartPoint[]; yMin: number; yMax: number } {
  const padL = 52;
  const padR = 16;
  const padT = 12;
  const W = 560;
  const innerW = W - padL - padR;
  const innerH = 200 - padT - 36;
  let cum = 0n;
  const ys: number[] = [];
  const n = steps.length;
  const raw = steps.map((s, i) => {
    const c = profitCycleForTrustStep(cycles, s.cycle_id);
    cum += allocationForVoter(c, voterLc);
    const yv = nav1e18ToNumber(cum);
    ys.push(yv);
    const x = n === 1 ? padL + innerW / 2 : padL + (innerW * i) / Math.max(1, n - 1);
    return { x, y: yv, label: s.cycle_id, yv };
  });
  let yMin = Math.min(0, ...ys);
  let yMax = Math.max(1e-9, ...ys);
  if (yMax - yMin < 1e-12) {
    yMax = yMin + 1e-6;
  } else if (yMax - yMin < (yMax + yMin) * 0.05) {
    const pad = (yMax - yMin) * 0.1 || 0.01;
    yMin -= pad;
    yMax += pad;
  }
  const points = raw.map((r) => {
    const yn = (r.yv - yMin) / (yMax - yMin || 1);
    const y = padT + innerH * (1 - yn);
    return { x: r.x, y, label: r.label };
  });
  return { points, yMin, yMax };
}

function formatNavTick(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const ax = Math.abs(v);
  if (ax >= 1e9) return v.toExponential(1);
  if (ax >= 1) return v.toFixed(2);
  if (ax >= 0.01) return v.toFixed(4);
  return v.toExponential(1);
}

export function VotingHistoryTab({ snap }: { snap: VaultSnapshot }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const [manualAddr, setManualAddr] = useState("");
  const [chartMode, setChartMode] = useState<HistoryChartMode>("trust");
  const chartUid = useId().replace(/:/g, "");

  const q = useQuery({
    queryKey: ["trust-history"],
    queryFn: fetchTrustHistory,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const profitsQ = useQuery({
    queryKey: ["cycle-profits"],
    queryFn: fetchCycleProfits,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const profitCycles = profitsQ.data?.cycles ?? [];

  const lookupKey = (isConnected && address ? address : manualAddr.trim()).toLowerCase();

  const steps: TrustHistoryStep[] | undefined = useMemo(() => {
    if (!lookupKey.startsWith("0x") || lookupKey.length !== 42) return undefined;
    const data = q.data as TrustHistoryPayload | null;
    if (!data?.byVoter) return undefined;
    return data.byVoter[lookupKey];
  }, [q.data, lookupKey]);

  const payload = q.data;

  const trustSeries = useMemo(() => {
    if (!payload || !steps?.length) return null;
    return buildTrustChartSeries(steps, payload.defaultTrust, payload.trustFloor, payload.trustCeiling);
  }, [payload, steps]);

  const profitSeries = useMemo(() => {
    if (!steps?.length) return null;
    return buildProfitChartSeries(steps, profitCycles, lookupKey);
  }, [steps, profitCycles, lookupKey]);

  const balanceSeries = useMemo(() => {
    if (!steps?.length) return null;
    return buildBalanceChartSeries(steps, profitCycles, lookupKey);
  }, [steps, profitCycles, lookupKey]);

  const profitMatchCount = useMemo(() => {
    if (!steps?.length) return 0;
    return steps.filter((s) => profitCycleForTrustStep(profitCycles, s.cycle_id) != null).length;
  }, [steps, profitCycles]);

  const hasAnyAllocation = useMemo(() => {
    if (!steps?.length) return false;
    return steps.some((s) => allocationForVoter(profitCycleForTrustStep(profitCycles, s.cycle_id), lookupKey) > 0n);
  }, [steps, profitCycles, lookupKey]);

  return (
    <section className="panel voting-history-page">
      <h2 className="voting-page-title">Voting &amp; trust history</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Per-cycle data from <code className="mono">trust-history.json</code> (<code className="mono">npm run trust:export</code> in{" "}
        <code className="mono">apps/agent</code>). Use the chart toggles for <strong>trust</strong>, per-close <strong>profits</strong>, and
        cumulative <strong>balance</strong> (profit slices from <code className="mono">cycle-profits.json</code> /{" "}
        <code className="mono">npm run profit:export</code>, matched by cycle id). Table below: benchmark (bps) and trust floor{" "}
        {payload?.trustFloor ?? "—"} … ceiling {payload?.trustCeiling ?? "—"}.
      </p>

      <div className="voting-card voting-card--muted" style={{ marginBottom: "1rem" }}>
        <div className="voting-card__body">
          {!isConnected ? (
            <div className="history-wallet-row">
              <p className="muted small" style={{ margin: 0 }}>
                Connect a wallet to load your address, or paste a voter address below.
              </p>
              {connectors[0] ? (
                <button type="button" className="btn btn-primary" disabled={isConnecting} onClick={() => connect({ connector: connectors[0] })}>
                  {isConnecting ? "Connecting…" : "Connect wallet"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mono sm" style={{ margin: 0 }}>
              Viewing: <strong>{address}</strong>
            </p>
          )}
          <label className="history-manual-label">
            <span className="muted small">Or paste voter 0x…</span>
            <input
              type="text"
              className="history-manual-input mono"
              placeholder="0x…"
              value={manualAddr}
              onChange={(e) => setManualAddr(e.target.value.trim())}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
        </div>
      </div>

      {q.isLoading ? <div className="muted">Loading history…</div> : null}
      {q.isError || (!q.isLoading && !payload) ? (
        <div className="voting-card voting-card--muted">
          <div className="voting-card__body muted small">
            Could not load <code>/trust-history.json</code>. Run <code>npm run trust:export</code> from repo root (after trust CSV exists).
          </div>
        </div>
      ) : null}

      {payload && lookupKey.startsWith("0x") && lookupKey.length === 42 && steps === undefined ? (
        <div className="voting-card voting-card--muted">
          <div className="voting-card__body muted small">
            No trust rows for this address yet — vote and wait for a wall-clock window to close + trust finalize.
          </div>
        </div>
      ) : null}

      {payload && steps && steps.length > 0 ? (
        <>
          <div className="voting-card">
            <div className="voting-card__header voting-card__header--wrap">
              <h3>Over cycles</h3>
              {payload._meta?.updatedAt ? (
                <span className="muted small mono">Trust export {payload._meta.updatedAt}</span>
              ) : null}
            </div>
            <div className="voting-card__body">
              <div className="history-chart-tabs" role="tablist" aria-label="History chart metric">
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartMode === "trust"}
                  className={`btn ${chartMode === "trust" ? "btn-primary" : ""}`}
                  onClick={() => setChartMode("trust")}
                >
                  Trust
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartMode === "profits"}
                  className={`btn ${chartMode === "profits" ? "btn-primary" : ""}`}
                  onClick={() => setChartMode("profits")}
                >
                  Profits
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartMode === "balance"}
                  className={`btn ${chartMode === "balance" ? "btn-primary" : ""}`}
                  onClick={() => setChartMode("balance")}
                >
                  Balance
                </button>
              </div>

              {chartMode !== "trust" && profitsQ.isError ? (
                <p className="muted small" style={{ marginTop: "0.75rem" }}>
                  Could not load <code className="mono">/cycle-profits.json</code> — profit/balance charts need{" "}
                  <code className="mono">npm run profit:export</code>.
                </p>
              ) : null}
              {chartMode !== "trust" && !profitsQ.isError && profitsQ.isLoading ? (
                <p className="muted small" style={{ marginTop: "0.75rem" }}>
                  Loading <code className="mono">cycle-profits.json</code>…
                </p>
              ) : null}

              {chartMode === "trust" && trustSeries ? (
                <HistoryLineChart
                  points={trustSeries.points}
                  yMin={trustSeries.yMin}
                  yMax={trustSeries.yMax}
                  formatYTick={(v) => v.toFixed(2)}
                  stroke="#3d9a8b"
                  gradientId={`${chartUid}-grad-trust`}
                  caption="Trust score after each finalized window (y-axis). X-axis: cycle id from trust export."
                  emptyHint="No finalized cycles yet."
                />
              ) : null}

              {chartMode === "profits" && !profitsQ.isError && !profitsQ.isLoading && profitSeries ? (
                <>
                  {profitMatchCount === 0 ? (
                    <p className="muted small" style={{ marginTop: "0.5rem" }}>
                      No <code className="mono">cycle-profits.json</code> rows matched these trust cycle ids (check{" "}
                      <code className="mono">voteStoreCycleKey</code> / <code className="mono">wallClockIndex</code>).
                    </p>
                  ) : null}
                  {profitMatchCount > 0 && !hasAnyAllocation ? (
                    <p className="muted small" style={{ marginTop: "0.5rem" }}>
                      Matched {profitMatchCount} close(s) but no profit allocation row for this address (did not vote on-chain for that close).
                    </p>
                  ) : null}
                  <HistoryLineChart
                    points={profitSeries.points}
                    yMin={profitSeries.yMin}
                    yMax={profitSeries.yMax}
                    formatYTick={formatNavTick}
                    stroke="#d4a84b"
                    gradientId={`${chartUid}-grad-profit`}
                    caption="Attributed profit slice per close (NAV-scale units ÷ 1e18). Sourced from cycle-profits.json, aligned to the same cycle order as trust."
                    emptyHint="No data points."
                  />
                </>
              ) : null}

              {chartMode === "balance" && !profitsQ.isError && !profitsQ.isLoading && balanceSeries ? (
                <HistoryLineChart
                  points={balanceSeries.points}
                  yMin={balanceSeries.yMin}
                  yMax={balanceSeries.yMax}
                  formatYTick={formatNavTick}
                  stroke="#7eb8da"
                  gradientId={`${chartUid}-grad-balance`}
                  caption="Cumulative attributed profit (sum of slices above) in cycle order — Tier A JSON accounting, not wallet token balance."
                  emptyHint="No data points."
                />
              ) : null}
            </div>
          </div>

          <div className="voting-card">
            <div className="voting-card__header">
              <h3>Cycle breakdown</h3>
            </div>
            <div className="voting-card__body table-wrap history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Window</th>
                    <th>Trust Δ</th>
                    <th>Trust after</th>
                    <th>Vote return</th>
                    <th>Benchmark</th>
                    <th>Your weights</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((row) => (
                    <tr key={row.cycle_id}>
                      <td className="mono">#{row.cycle_id}</td>
                      <td className={`mono ${row.delta_trust >= 0 ? "delta-pos" : "delta-neg"}`}>
                        {row.delta_trust >= 0 ? "+" : ""}
                        {row.delta_trust.toFixed(4)}
                      </td>
                      <td className="mono">{row.trust_after.toFixed(4)}</td>
                      <td className="mono sm" title="Time-weighted portfolio return (see scoring.yaml)">
                        {formatBpsAsPercent(row.vote_return_bps)}
                        <span className="muted"> ({row.vote_return_bps.toLocaleString()} bps)</span>
                      </td>
                      <td className="mono sm">{formatBpsAsPercent(row.benchmark_return_bps)}</td>
                      <td className="history-weights">
                        {row.weights && Object.keys(row.weights).length > 0 ? (
                          <ul className="ballot-weight-list">
                            {Object.entries(row.weights)
                              .sort((a, b) => b[1] - a[1])
                              .map(([addr, w]) => (
                                <li key={addr}>
                                  <a
                                    className="ext mono sm"
                                    href={`${explorerBase(snap.chainId)}/token/${addr}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {assetSymbolForAddress(snap, addr)}
                                  </a>{" "}
                                  <span className="mono muted">{pctFromFraction(w)}</span>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
