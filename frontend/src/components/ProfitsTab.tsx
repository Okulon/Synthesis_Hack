import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { explorerBase } from "../lib/client";
import { fetchCycleProfits, type CycleProfitRow } from "../lib/cycleProfits";
import { formatNav1e18, shortAddr, type VaultSnapshot } from "../lib/vault";

function ExplorerLink({
  chainId,
  path,
  children,
}: {
  chainId: number;
  path: string;
  children: ReactNode;
}) {
  const base = explorerBase(chainId);
  return (
    <a href={`${base}${path}`} target="_blank" rel="noreferrer" className="ext">
      {children}
    </a>
  );
}

function normalizeAddr(a: string): string {
  return a.trim().toLowerCase();
}

function cycleLabel(c: CycleProfitRow, i: number): string {
  return c.voteStoreCycleKey ?? (c.wallClockIndex != null ? `#${c.wallClockIndex}` : `C${i + 1}`);
}

type YourCycleRow = {
  label: string;
  pool: bigint;
  yours: bigint;
  pctOfPool: number;
  rank: number;
  participants: number;
  closedAt: string | null;
  txHash: string | null;
};

function buildYourCycleRows(cycles: CycleProfitRow[], addr: string | null): YourCycleRow[] {
  if (!addr) return [];
  const k = normalizeAddr(addr);
  const chronological = [...cycles].sort((a, b) => {
    const ta = Date.parse(a.closedAt ?? "") || 0;
    const tb = Date.parse(b.closedAt ?? "") || 0;
    return ta - tb;
  });
  return chronological.map((c, i) => {
    const pool = BigInt(c.profitPool1e18);
    const sorted = [...c.participants].sort(
      (a, b) => (BigInt(b.allocation1e18) > BigInt(a.allocation1e18) ? 1 : -1),
    );
    const idx = sorted.findIndex((p) => normalizeAddr(p.address) === k);
    const p = c.participants.find((x) => normalizeAddr(x.address) === k);
    const yours = p ? BigInt(p.allocation1e18) : 0n;
    const pct = pool > 0n && yours > 0n ? Number((yours * 10000n) / pool) / 100 : 0;
    return {
      label: cycleLabel(c, i),
      pool,
      yours,
      pctOfPool: pct,
      rank: idx >= 0 ? idx + 1 : 0,
      participants: c.participantCount,
      closedAt: c.closedAt,
      txHash: c.txHash,
    };
  });
}

function buildLeaderboard(cycles: CycleProfitRow[]) {
  const map = new Map<string, bigint>();
  for (const c of cycles) {
    for (const p of c.participants) {
      const k = normalizeAddr(p.address);
      map.set(k, (map.get(k) ?? 0n) + BigInt(p.allocation1e18));
    }
  }
  return [...map.entries()]
    .map(([address, total]) => ({ address, total }))
    .sort((a, b) => (a.total < b.total ? 1 : a.total > b.total ? -1 : 0));
}

function totalDistributed(cycles: CycleProfitRow[]): bigint {
  let s = 0n;
  for (const c of cycles) {
    for (const p of c.participants) s += BigInt(p.allocation1e18);
  }
  return s;
}

function totalPools(cycles: CycleProfitRow[]): bigint {
  let s = 0n;
  for (const c of cycles) s += BigInt(c.profitPool1e18);
  return s;
}

/** Vertical bar chart — values as bigint, format for labels */
function ProfitsBarChart({
  labels,
  values,
  title,
  accent = "teal",
}: {
  labels: string[];
  values: bigint[];
  title: string;
  accent?: "teal" | "coral";
}) {
    const { bars, maxV, W, H, padL, padT, innerW, innerH } = useMemo(() => {
    const W0 = 560;
    const H0 = 220;
    const pL = 48;
    const pR = 16;
    const pT = 28;
    const pB = 36;
    const iw = W0 - pL - pR;
    const ih = H0 - pT - pB;
    const maxVal = values.reduce((m, v) => (v > m ? v : m), 0n);
    const maxV0 = maxVal > 0n ? maxVal : 1n;
    const n = Math.max(1, values.length);
    const gap = 4;
    const bw = Math.max(4, (iw - gap * (n - 1)) / n);
    const bars0 = values.map((v, i) => {
      const h = maxV0 > 0n ? (Number(v) / Number(maxV0)) * ih : 0;
      const x = pL + i * (bw + gap);
      const y = pT + ih - h;
      return { x, y, w: bw, h, v };
    });
    return {
      bars: bars0,
      maxV: maxV0,
      W: W0,
      H: H0,
      padL: pL,
      padT: pT,
      innerW: iw,
      innerH: ih,
    };
  }, [values]);

  const fill = accent === "coral" ? "url(#profitsBarCoral)" : "url(#profitsBarTeal)";

  return (
    <div className="profits-chart-card">
      <div className="profits-chart-card__title">{title}</div>
      <svg className="profits-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="profitsBarTeal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ec4b0" />
            <stop offset="100%" stopColor="#2a7a6e" />
          </linearGradient>
          <linearGradient id="profitsBarCoral" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e07a5f" />
            <stop offset="100%" stopColor="#8f3d2e" />
          </linearGradient>
        </defs>
        <rect
          x={padL}
          y={padT}
          width={innerW}
          height={innerH}
          fill="none"
          stroke="rgba(232,220,200,0.12)"
          rx="4"
        />
        {bars.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={Math.max(b.h, 0)} fill={fill} rx="2" opacity={0.92} />
            <text
              x={b.x + b.w / 2}
              y={H - 10}
              textAnchor="middle"
              className="profits-svg-label"
              fontSize="9"
            >
              {labels[i]?.slice(0, 6) ?? i}
            </text>
          </g>
        ))}
        <text x={4} y={padT + 12} className="profits-svg-tick" fontSize="9">
          {maxV > 0n ? formatNav1e18(maxV, 2) : "—"}
        </text>
      </svg>
    </div>
  );
}

/** Stacked horizontal segments per cycle: top 3 addresses + rest */
function PoolsStackedChart({ cycles }: { cycles: CycleProfitRow[] }) {
  const rows = useMemo(() => {
    const chrono = [...cycles].sort((a, b) => {
      const ta = Date.parse(a.closedAt ?? "") || 0;
      const tb = Date.parse(b.closedAt ?? "") || 0;
      return ta - tb;
    });
    return chrono.map((c, i) => {
      const pool = BigInt(c.profitPool1e18);
      const top = [...c.participants]
        .sort((a, b) => (BigInt(b.allocation1e18) > BigInt(a.allocation1e18) ? 1 : -1))
        .slice(0, 3);
      const topSum = top.reduce((s, p) => s + BigInt(p.allocation1e18), 0n);
      const rest = pool > topSum ? pool - topSum : 0n;
      return { c, i, pool, top, rest, label: cycleLabel(c, i) };
    });
  }, [cycles]);

  const W = 560;
  const rowH = 22;
  const gap = 8;
  const padL = 72;
  const padR = 12;
  const barW = W - padL - padR;
  const H = Math.max(120, rows.length * (rowH + gap) + 40);

  const colors = ["#4ec4b0", "#c45c3e", "#7b68a6", "rgba(232,220,200,0.2)"];

  return (
    <div className="profits-chart-card">
      <div className="profits-chart-card__title">Pool split by cycle</div>
      <svg className="profits-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {rows.length === 0 ? (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="profits-svg-tick" fontSize="11">
            —
          </text>
        ) : (
          rows.map((r, ri) => {
            const y = 32 + ri * (rowH + gap);
            let xOff = 0;
            const segs: { w: number; color: string; addr?: string }[] = [];
            for (let t = 0; t < r.top.length; t++) {
              const a = BigInt(r.top[t].allocation1e18);
              const frac = r.pool > 0n ? Number((a * BigInt(10000)) / r.pool) / 10000 : 0;
              segs.push({
                w: barW * frac,
                color: colors[t] ?? colors[0],
                addr: r.top[t].address,
              });
            }
            if (r.rest > 0n && r.pool > 0n) {
              segs.push({
                w: barW * (Number((r.rest * BigInt(10000)) / r.pool) / 10000),
                color: colors[3],
              });
            }
            return (
              <g key={ri}>
                <text x={padL - 8} y={y + rowH / 2 + 4} textAnchor="end" className="profits-svg-label" fontSize="10">
                  {r.label}
                </text>
                <rect x={padL} y={y} width={barW} height={rowH} fill="rgba(0,0,0,0.25)" rx="4" />
                {segs.map((s, si) => {
                  const x = padL + xOff;
                  xOff += s.w;
                  return (
                    <rect
                      key={si}
                      x={x}
                      y={y}
                      width={Math.max(s.w, 0)}
                      height={rowH}
                      fill={s.color}
                      rx={si === 0 ? 4 : 0}
                      className={s.addr ? "profits-stack-seg" : undefined}
                    >
                      {s.addr ? <title>{shortAddr(s.addr, 10)}</title> : null}
                    </rect>
                  );
                })}
                <text
                  x={padL + barW + 6}
                  y={y + rowH / 2 + 4}
                  className="profits-svg-tick"
                  fontSize="9"
                >
                  {formatNav1e18(r.pool, 2)}
                </text>
              </g>
            );
          })
        )}
      </svg>
      <div className="profits-stack-legend">
        <span>
          <i className="profits-leg-dot" style={{ background: colors[0] }} /> 1st
        </span>
        <span>
          <i className="profits-leg-dot" style={{ background: colors[1] }} /> 2nd
        </span>
        <span>
          <i className="profits-leg-dot" style={{ background: colors[2] }} /> 3rd
        </span>
        <span>
          <i className="profits-leg-dot" style={{ background: colors[3] }} /> other
        </span>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="profits-stat-tile">
      <span className="profits-stat-tile__label">{label}</span>
      <span className="profits-stat-tile__value mono">{value}</span>
      {sub ? <span className="profits-stat-tile__sub muted small mono">{sub}</span> : null}
    </div>
  );
}

export function ProfitsTab({ snap }: { snap: VaultSnapshot }) {
  const { address: wagmiAddr } = useAccount();
  const [manual, setManual] = useState("");

  const q = useQuery({
    queryKey: ["cycle-profits"],
    queryFn: fetchCycleProfits,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const effectiveAddr = useMemo(() => {
    const m = manual.trim();
    if (m.startsWith("0x") && m.length >= 42) return m;
    return wagmiAddr ?? null;
  }, [manual, wagmiAddr]);

  const cycles = q.data?.cycles ?? [];
  const yourKey = effectiveAddr ? normalizeAddr(effectiveAddr) : null;

  const yourTotal = useMemo(() => {
    if (!yourKey) return 0n;
    let s = 0n;
    for (const c of cycles) {
      const p = c.participants.find((x) => normalizeAddr(x.address) === yourKey);
      if (p) s += BigInt(p.allocation1e18);
    }
    return s;
  }, [cycles, yourKey]);

  const yourRows = useMemo(() => buildYourCycleRows(cycles, yourKey), [cycles, yourKey]);
  const leaderboard = useMemo(() => buildLeaderboard(cycles), [cycles]);
  const distTotal = useMemo(() => totalDistributed(cycles), [cycles]);
  const poolsTotal = useMemo(() => totalPools(cycles), [cycles]);

  const yourShareOfAll =
    distTotal > 0n && yourTotal > 0n ? Number((yourTotal * 10000n) / distTotal) / 100 : 0;

  const cyclesWithPayout = yourRows.filter((r) => r.yours > 0n).length;
  const bestCycle = useMemo(() => {
    let max = 0n;
    for (const r of yourRows) if (r.yours > max) max = r.yours;
    return max;
  }, [yourRows]);

  const yourRankOverall = useMemo(() => {
    if (!yourKey) return null;
    const idx = leaderboard.findIndex((x) => x.address === yourKey);
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboard, yourKey]);

  const maxSinglePayout = useMemo(() => {
    let m = 0n;
    for (const c of cycles) {
      for (const p of c.participants) {
        const a = BigInt(p.allocation1e18);
        if (a > m) m = a;
      }
    }
    return m;
  }, [cycles]);

  const chartLabels = useMemo(() => yourRows.map((r) => r.label), [yourRows]);
  const chartValues = useMemo(() => yourRows.map((r) => r.yours), [yourRows]);

  const poolChartLabels = useMemo(() => {
    const chrono = [...cycles].sort((a, b) => {
      const ta = Date.parse(a.closedAt ?? "") || 0;
      const tb = Date.parse(b.closedAt ?? "") || 0;
      return ta - tb;
    });
    return chrono.map((c, i) => cycleLabel(c, i));
  }, [cycles]);

  const poolChartValues = useMemo(() => {
    const chrono = [...cycles].sort((a, b) => {
      const ta = Date.parse(a.closedAt ?? "") || 0;
      const tb = Date.parse(b.closedAt ?? "") || 0;
      return ta - tb;
    });
    return chrono.map((c) => BigInt(c.profitPool1e18));
  }, [cycles]);

  const cumulativeValues = useMemo(() => {
    let acc = 0n;
    return yourRows.map((r) => {
      acc += r.yours;
      return acc;
    });
  }, [yourRows]);

  const cumMax = cumulativeValues.reduce((m, v) => (v > m ? v : m), 0n) || 1n;
  const cumChart = useMemo(() => {
    const W = 560;
    const H = 160;
    const padL = 44;
    const padR = 16;
    const padT = 16;
    const padB = 28;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const n = Math.max(1, cumulativeValues.length);
    const pts = cumulativeValues.map((v, i) => {
      const x = padL + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
      const yn = cumMax > 0n ? (Number(v) / Number(cumMax)) * ih : 0;
      const y = padT + ih - yn;
      return { x, y };
    });
    const pathD =
      pts.length > 0 ? `M ${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}` : "";
    return { W, H, pathD, pts, padL, padT, iw, ih };
  }, [cumulativeValues, cumMax]);

  return (
    <section className="panel profits-v2">
      <header className="profits-v2__hero">
        <div>
          <h2 className="profits-v2__title">Profits</h2>
          {q.data?.testGainsActive ? (
            <span
              className="profits-v2__badge"
              title={
                q.data.testGainsRange
                  ? `Each close: random in [${q.data.testGainsRange.min1e18}, ${q.data.testGainsRange.max1e18}] then ${q.data.testGainsRange.poolClamp}`
                  : "Synthetic pool from TESTGAINS"
              }
            >
              TESTGAINS
            </span>
          ) : null}
        </div>
        <div className="profits-v2__hero-right">
          <input
            className="profits-v2__input mono"
            placeholder="0x…"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          {q.data?._meta?.updatedAt ? (
            <span className="profits-v2__stamp mono">{new Date(q.data._meta.updatedAt).toLocaleString()}</span>
          ) : null}
        </div>
      </header>

      {q.isLoading ? <div className="profits-v2__state">Loading…</div> : null}
      {q.isError ? <div className="profits-v2__state profits-v2__state--err">No cycle-profits.json</div> : null}

      {!q.isLoading && !q.isError && cycles.length === 0 ? (
        <div className="profits-v2__state">No closes yet</div>
      ) : null}

      {cycles.length > 0 ? (
        <>
          {yourKey ? (
            <section className="profits-v2__section">
              <h3 className="profits-v2__h3">You</h3>
              <div className="profits-v2__stat-grid">
                <StatTile label="Total" value={formatNav1e18(yourTotal, 4)} />
                <StatTile
                  label="Cycles paid"
                  value={String(cyclesWithPayout)}
                  sub={`of ${cycles.length}`}
                />
                <StatTile label="Best cycle" value={formatNav1e18(bestCycle, 4)} />
                <StatTile
                  label="Share of distributed"
                  value={`${yourShareOfAll.toFixed(2)}%`}
                  sub={yourRankOverall ? `rank #${yourRankOverall}` : undefined}
                />
              </div>

              <div className="profits-v2__charts-row">
                {yourRows.length > 0 ? (
                  <ProfitsBarChart labels={chartLabels} values={chartValues} title="Per cycle" accent="teal" />
                ) : null}
                {yourRows.length > 1 && cumulativeValues.some((v) => v > 0n) ? (
                  <div className="profits-chart-card">
                    <div className="profits-chart-card__title">Cumulative</div>
                    <svg
                      className="profits-svg"
                      viewBox={`0 0 ${cumChart.W} ${cumChart.H}`}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <defs>
                        <linearGradient id="profitsCumFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4ec4b0" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#4ec4b0" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      <rect
                        x={cumChart.padL}
                        y={cumChart.padT}
                        width={cumChart.iw}
                        height={cumChart.ih}
                        fill="none"
                        stroke="rgba(232,220,200,0.1)"
                        rx="4"
                      />
                      {cumChart.pathD ? (
                        <>
                          <path
                            d={`${cumChart.pathD} L ${cumChart.pts[cumChart.pts.length - 1]?.x.toFixed(1) ?? 0},${(cumChart.padT + cumChart.ih).toFixed(1)} L ${cumChart.pts[0]?.x.toFixed(1) ?? 0},${(cumChart.padT + cumChart.ih).toFixed(1)} Z`}
                            fill="url(#profitsCumFill)"
                          />
                          <path
                            d={cumChart.pathD}
                            fill="none"
                            stroke="#4ec4b0"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                          {cumChart.pts.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r="4" fill="#14121a" stroke="#4ec4b0" strokeWidth="2" />
                          ))}
                        </>
                      ) : null}
                    </svg>
                  </div>
                ) : null}
              </div>

              <div className="table-wrap profits-v2__table-wrap">
                <table className="profits-v2__table">
                  <thead>
                    <tr>
                      <th>Cycle</th>
                      <th>Pool</th>
                      <th>Yours</th>
                      <th>% pool</th>
                      <th>Rank</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {yourRows.map((r) => (
                      <tr key={r.label + (r.closedAt ?? "")} className={r.yours > 0n ? "profits-v2__tr--on" : ""}>
                        <td className="mono">{r.label}</td>
                        <td className="mono sm">{formatNav1e18(r.pool, 3)}</td>
                        <td className="mono sm">{formatNav1e18(r.yours, 4)}</td>
                        <td className="mono sm">{r.yours > 0n ? `${r.pctOfPool.toFixed(2)}%` : "—"}</td>
                        <td className="mono sm">
                          {r.rank > 0 ? `${r.rank}/${r.participants}` : "—"}
                        </td>
                        <td className="mono sm">
                          {r.txHash ? (
                            <ExplorerLink chainId={snap.chainId} path={`/tx/${r.txHash}`}>
                              tx
                            </ExplorerLink>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="profits-v2__section">
              <p className="profits-v2__hint">Connect or enter an address</p>
            </section>
          )}

          <section className="profits-v2__section">
            <h3 className="profits-v2__h3">Everyone</h3>
            <div className="profits-v2__stat-grid profits-v2__stat-grid--wide">
              <StatTile label="Pools (sum)" value={formatNav1e18(poolsTotal, 3)} sub={`${cycles.length} closes`} />
              <StatTile label="Distributed" value={formatNav1e18(distTotal, 3)} />
              <StatTile label="Recipients" value={String(leaderboard.length)} />
              <StatTile label="Largest single" value={formatNav1e18(maxSinglePayout, 4)} />
            </div>

            <div className="profits-v2__charts-row">
              <ProfitsBarChart labels={poolChartLabels} values={poolChartValues} title="Pool size" accent="coral" />
              <PoolsStackedChart cycles={cycles} />
            </div>

            <div className="table-wrap profits-v2__table-wrap">
              <table className="profits-v2__table profits-v2__table--leader">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Address</th>
                    <th>Total</th>
                    <th>Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted mono">
                        —
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((row, i) => {
                      const maxL = leaderboard[0]?.total ?? 1n;
                      const barPct = maxL > 0n ? Number((row.total * 1000n) / maxL) / 10 : 0;
                      const isYou = yourKey && row.address === yourKey;
                      return (
                        <tr key={row.address} className={isYou ? "profits-v2__tr--you" : undefined}>
                          <td className="mono muted">{i + 1}</td>
                          <td className="mono sm">
                            <ExplorerLink chainId={snap.chainId} path={`/address/${row.address}`}>
                              {shortAddr(row.address, 10)}
                            </ExplorerLink>
                            {isYou ? <span className="profits-v2__you-dot" /> : null}
                          </td>
                          <td className="mono sm">{formatNav1e18(row.total, 4)}</td>
                          <td className="profits-v2__leader-bar-cell">
                            <div className="profits-v2__leader-track">
                              <div className="profits-v2__leader-fill" style={{ width: `${barPct}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
