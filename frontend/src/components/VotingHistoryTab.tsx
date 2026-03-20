import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import {
  fetchTrustHistory,
  formatBpsAsPercent,
  type TrustHistoryPayload,
  type TrustHistoryStep,
} from "../lib/trustHistory";
import { explorerBase } from "../lib/client";
import { shortAddr, type VaultSnapshot } from "../lib/vault";
import { pctFromFraction } from "../lib/allocationVotes";

function assetSymbolForAddress(snap: VaultSnapshot, addr: string): string {
  const key = addr.toLowerCase();
  const tracked = snap.assets.find((x) => x.address.toLowerCase() === key);
  if (tracked?.symbol) return tracked.symbol;
  const ballot = snap.ballotAssets.find((x) => x.address.toLowerCase() === key);
  return ballot?.symbol ?? shortAddr(addr, 5);
}

function TrustOverCyclesChart({
  steps,
  defaultTrust,
  floor,
  ceiling,
}: {
  steps: TrustHistoryStep[];
  defaultTrust: number;
  floor: number;
  ceiling: number;
}) {
  const series = useMemo(() => {
    const padL = 44;
    const padR = 16;
    const padT = 12;
    const W = 560;
    const H = 200;
    const innerW = W - padL - padR;
    const innerH = H - padT - 36;
    if (steps.length === 0) {
      return { points: [] as { x: number; y: number; label: string }[], yMin: 0, yMax: 1, padL, padT, W, H, innerW, innerH };
    }
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
    return { points, yMin, yMax, padL, padT, W, H, innerW, innerH };
  }, [steps, defaultTrust, floor, ceiling]);

  if (steps.length === 0) {
    return <p className="muted small">No finalized cycles yet.</p>;
  }

  const { points, yMin, yMax, padL, padT, W, H, innerW, innerH } = series;
  const pathD =
    points.length > 0
      ? `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}`
      : "";

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  return (
    <div className="trust-chart-wrap">
      <svg className="trust-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="trustLineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d9a8b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3d9a8b" stopOpacity="0.2" />
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
                {yt.toFixed(2)}
              </text>
            </g>
          );
        })}
        {pathD ? (
          <>
            <path d={pathD} fill="none" stroke="#3d9a8b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="5" fill="#14121a" stroke="#3d9a8b" strokeWidth="2" />
            ))}
          </>
        ) : null}
        {points.map((p, i) => (
          <text key={`l-${i}`} x={p.x} y={H - 8} textAnchor="middle" className="trust-chart-label" fontSize="11">
            #{p.label}
          </text>
        ))}
      </svg>
      <p className="muted small trust-chart-caption">Trust score after each finalized wall-clock window (y-axis).</p>
    </div>
  );
}

export function VotingHistoryTab({ snap }: { snap: VaultSnapshot }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const [manualAddr, setManualAddr] = useState("");

  const q = useQuery({
    queryKey: ["trust-history"],
    queryFn: fetchTrustHistory,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const lookupKey = (isConnected && address ? address : manualAddr.trim()).toLowerCase();

  const steps: TrustHistoryStep[] | undefined = useMemo(() => {
    if (!lookupKey.startsWith("0x") || lookupKey.length !== 42) return undefined;
    const data = q.data as TrustHistoryPayload | null;
    if (!data?.byVoter) return undefined;
    return data.byVoter[lookupKey];
  }, [q.data, lookupKey]);

  const payload = q.data;

  return (
    <section className="panel voting-history-page">
      <h2 className="voting-page-title">Voting &amp; trust history</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Per-cycle data from <code className="mono">trust-history.json</code> (run <code className="mono">npm run trust:export</code> in{" "}
        <code className="mono">apps/agent</code> or let the agent export on rollover). Shows how your ballot weights performed vs benchmark
        (bps) and how trust moved (floor {payload?.trustFloor ?? "—"} … ceiling {payload?.trustCeiling ?? "—"}).
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
            <div className="voting-card__header">
              <h3>Trust over cycles</h3>
              {payload._meta?.updatedAt ? (
                <span className="muted small mono">Updated {payload._meta.updatedAt}</span>
              ) : null}
            </div>
            <div className="voting-card__body">
              <TrustOverCyclesChart
                steps={steps}
                defaultTrust={payload.defaultTrust}
                floor={payload.trustFloor}
                ceiling={payload.trustCeiling}
              />
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
