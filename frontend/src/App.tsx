import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatUnits, type PublicClient } from "viem";
import { createVaultClient, explorerBase } from "./lib/client";
import { normalizeEnvString, parseVaultAddress } from "./lib/env";
import { AllocationBallotPanel } from "./components/AllocationBallotPanel";
import { AllocationPieChart, type PieSegment } from "./components/AllocationPieChart";
import { DepositPanel } from "./components/DepositPanel";
import { TestSwapDepositPanel } from "./components/TestSwapDepositPanel";
import {
  fetchVaultSnapshot,
  formatAssetWeightPct,
  formatNav1e18,
  shortAddr,
  type VaultSnapshot,
} from "./lib/vault";
import { fetchAllocationVotes, pctFromFraction } from "./lib/allocationVotes";
import {
  computeLiveManagedCycle,
  formatCountdown,
  type ManagedClockPayload,
} from "./lib/managedCycle";
import {
  buildHolderVoteRows,
  computeOnChainTargets,
  computeQuorumStats,
  type QuorumStats,
  votedAddressSet,
} from "./lib/votingMetrics";
import { fetchTrustScores, trustForAddress } from "./lib/trustScores";

const RPC = normalizeEnvString(import.meta.env.VITE_RPC_URL as string | undefined);
const VAULT_PARSED = parseVaultAddress(import.meta.env.VITE_VAULT_ADDRESS as string | undefined);
const VAULT_RAW = normalizeEnvString(import.meta.env.VITE_VAULT_ADDRESS as string | undefined);
const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || "84532");
const ROLE_FROM_BLOCK = import.meta.env.VITE_ROLE_LOGS_FROM_BLOCK
  ? BigInt(import.meta.env.VITE_ROLE_LOGS_FROM_BLOCK)
  : undefined;
const HOLDER_FROM_BLOCK = import.meta.env.VITE_HOLDER_LOGS_FROM_BLOCK
  ? BigInt(import.meta.env.VITE_HOLDER_LOGS_FROM_BLOCK)
  : undefined;
const ALLOCATION_VOTE_FROM_BLOCK = import.meta.env.VITE_ALLOCATION_VOTE_LOGS_FROM_BLOCK
  ? BigInt(import.meta.env.VITE_ALLOCATION_VOTE_LOGS_FROM_BLOCK)
  : undefined;

function Setup() {
  return (
    <div className="panel setup">
      <h1>DAO Vault dashboard</h1>
      <p className="lede">
        Add <code>frontend/.env.local</code> (copy from <code>frontend/.env.example</code>) with:
      </p>
      <ul className="env-list">
        <li>
          <code>VITE_RPC_URL</code> — Base Sepolia RPC (same idea as <code>CHAIN_RPC_URL</code> in repo root{" "}
          <code>.env</code>)
        </li>
        <li>
          <code>VITE_VAULT_ADDRESS</code> — deployed <code>DAOVault</code>
        </li>
        <li>
          <code>VITE_CHAIN_ID</code> — optional, default <code>84532</code>
        </li>
      </ul>
      <p className="hint">Then run <code>npm run dev</code> from <code>frontend/</code> (serves on port 1337).</p>
    </div>
  );
}

function BadVaultAddress() {
  return (
    <div className="panel setup error">
      <h1>Fix vault address</h1>
      {VAULT_RAW === "" ? (
        <>
          <p className="lede">
            <code>VITE_VAULT_ADDRESS</code> is missing or empty in <code>frontend/.env.local</code>.
          </p>
          <p className="lede">
            Vite only exposes names starting with <code>VITE_</code> — repo root <code>VAULT_ADDRESS</code> is not
            loaded here. Add:
          </p>
          <pre className="env-pre">
            {`VITE_VAULT_ADDRESS=<same 0x… as VAULT_ADDRESS in repo root .env>`}
          </pre>
          <p className="hint">Restart <code>npm run dev</code> after saving — env is read at startup.</p>
        </>
      ) : (
        <>
          <p className="lede">
            <code>VITE_VAULT_ADDRESS</code> is not a valid checksummed hex address.
          </p>
          <p className="mono muted">Got (after trim): {VAULT_RAW || "(empty)"}</p>
          <p className="hint">Remove spaces/quotes; use a full <code>0x</code> + 40 hex chars.</p>
        </>
      )}
    </div>
  );
}

function ExplorerLink({
  chainId,
  path,
  children,
}: {
  chainId: number;
  path: string;
  children: React.ReactNode;
}) {
  const base = explorerBase(chainId);
  return (
    <a href={`${base}${path}`} target="_blank" rel="noreferrer" className="ext">
      {children}
    </a>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {sub ? <span className="metric-sub">{sub}</span> : null}
    </div>
  );
}

function PausePill({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`pill ${on ? "on" : "off"}`}>
      {label}: {on ? "ON" : "off"}
    </span>
  );
}

function RolesTable({ snap }: { snap: VaultSnapshot }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Members</th>
          </tr>
        </thead>
        <tbody>
          {snap.roles.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="mono">
                {r.members.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  <span className="roles-members">
                    {r.members.map((a) => (
                      <ExplorerLink key={a} chainId={snap.chainId} path={`/address/${a}`}>
                        {shortAddr(a, 6)}
                      </ExplorerLink>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetsTable({ snap }: { snap: VaultSnapshot }) {
  if (snap.assets.length === 0) {
    return (
      <p className="muted empty-hint">
        No tracked assets yet (empty vault or no deposits). Deposit an allowlisted token to see balances and NAV
        lines.
      </p>
    );
  }
  return (
    <div className="table-wrap">
      <table className="assets">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Balance</th>
            <th>Price (1e18)</th>
            <th>Value (NAV)</th>
            <th>Allowed</th>
            <th>Oracles</th>
          </tr>
        </thead>
        <tbody>
          {snap.assets.map((a) => (
            <tr key={a.address}>
              <td>
                <div className="asset-name">
                  <span className="asset-weight mono" title="Share of vault NAV">
                    {formatAssetWeightPct(a.valueNav1e18, snap.totalNAV1e18)}
                  </span>
                  <span>{a.name || a.symbol}</span>
                </div>
                <ExplorerLink chainId={snap.chainId} path={`/token/${a.address}`}>
                  {shortAddr(a.address, 5)}
                </ExplorerLink>
              </td>
              <td className="mono">
                {formatUnits(a.balanceRaw, a.decimals)} {a.symbol}
              </td>
              <td className="mono sm">{a.price1e18 === 0n ? "—" : formatNav1e18(a.price1e18, 4)}</td>
              <td className="mono">{formatNav1e18(a.valueNav1e18, 2)}</td>
              <td>{a.isAllowed ? "✓" : "—"}</td>
              <td className="oracle-cell">
                <span className="mono sm">
                  P: {a.oracle.primaryAggregator === "0x0000000000000000000000000000000000000000" ? "—" : shortAddr(a.oracle.primaryAggregator, 4)}
                </span>
                <span className="mono sm">
                  S: {a.oracle.secondaryAggregator === "0x0000000000000000000000000000000000000000" ? "—" : shortAddr(a.oracle.secondaryAggregator, 4)}
                </span>
                {a.manualPrice1e18 !== 0n ? (
                  <span className="manual">manual until {String(a.manualExpiresAt)}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function assetSymbolForAddress(snap: VaultSnapshot, addr: string): string {
  const key = addr.toLowerCase();
  const tracked = snap.assets.find((x) => x.address.toLowerCase() === key);
  if (tracked?.symbol) return tracked.symbol;
  const ballot = snap.ballotAssets.find((x) => x.address.toLowerCase() === key);
  return ballot?.symbol ?? shortAddr(addr, 5);
}

export default function App() {
  const [view, setView] = useState<"dashboard" | "users" | "voting">("dashboard");
  if (!RPC) {
    return (
      <div className="shell">
        <Setup />
      </div>
    );
  }

  if (!VAULT_PARSED) {
    return (
      <div className="shell">
        <BadVaultAddress />
      </div>
    );
  }

  const client = createVaultClient(RPC, CHAIN_ID);

  const q = useQuery({
    queryKey: [
      "vault",
      CHAIN_ID,
      VAULT_PARSED,
      RPC,
      ROLE_FROM_BLOCK?.toString() ?? "0",
      HOLDER_FROM_BLOCK?.toString() ?? "h0",
      ALLOCATION_VOTE_FROM_BLOCK?.toString() ?? "a0",
    ],
    queryFn: () =>
      fetchVaultSnapshot(client as unknown as PublicClient, VAULT_PARSED, {
        roleLogsFromBlock: ROLE_FROM_BLOCK,
        holderLogsFromBlock: HOLDER_FROM_BLOCK,
        allocationVoteLogsFromBlock: ALLOCATION_VOTE_FROM_BLOCK,
      }),
    staleTime: 8_000,
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-top">
          <p className="eyebrow">Synthesis · DAOVault</p>
          <h1>{q.data?.vaultName ?? "DAO Vault"}</h1>
          <p className="tag">{q.data?.vaultSymbol ?? "…"} · chain {q.data?.chainId ?? CHAIN_ID}</p>
        </div>
        <div className="hero-actions">
          <div className="view-switch">
            <button
              type="button"
              className={`btn ${view === "dashboard" ? "btn-primary" : ""}`}
              onClick={() => setView("dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`btn ${view === "users" ? "btn-primary" : ""}`}
              onClick={() => setView("users")}
            >
              Users
            </button>
            <button
              type="button"
              className={`btn ${view === "voting" ? "btn-primary" : ""}`}
              onClick={() => setView("voting")}
            >
              Voting
            </button>
          </div>
          {q.data ? (
            <ExplorerLink chainId={q.data.chainId} path={`/address/${q.data.vault}`}>
              Basescan ↗
            </ExplorerLink>
          ) : null}
          <button type="button" className="btn" onClick={() => q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {q.isError ? (
        <div className="panel error">
          <strong>Could not load vault</strong>
          <pre>{q.error instanceof Error ? q.error.message : String(q.error)}</pre>
          <p className="hint">Check RPC URL, chain id, and vault address.</p>
        </div>
      ) : null}

      {q.isLoading ? <div className="panel loading">Reading chain…</div> : null}

      {q.data ? (
        view === "dashboard" ? (
          <Dashboard snap={q.data} />
        ) : view === "users" ? (
          <UsersPage snap={q.data} />
        ) : (
          <VotingPage snap={q.data} />
        )
      ) : null}

      <footer className="foot">
        Block {q.data?.blockNumber !== undefined ? String(q.data.blockNumber) : "—"}
        {q.data?.roleLogScan ? (
          <>
            {" "}
            · roles from logs {String(q.data.roleLogScan.fromBlock)}→{String(q.data.roleLogScan.toBlock)}
          </>
        ) : null}{" "}
        {q.data?.holderLogScan ? (
          <>
            · holders from logs {String(q.data.holderLogScan.fromBlock)}→{String(q.data.holderLogScan.toBlock)}
          </>
        ) : null}
        {q.data?.allocationVoteLogScan ? (
          <>
            {" "}
            · allocation ballots from logs {String(q.data.allocationVoteLogScan.fromBlock)}→
            {String(q.data.allocationVoteLogScan.toBlock)}
          </>
        ) : null}{" "}
        · wallet optional (deposit below)
      </footer>
    </div>
  );
}

function Dashboard({ snap }: { snap: VaultSnapshot }) {
  const explorer = explorerBase(snap.chainId);
  return (
    <>
      <DepositPanel
        vaultAddress={snap.vault}
        chainId={snap.chainId}
        pauseAll={snap.pauseAll}
        pauseDeposits={snap.pauseDeposits}
      />

      <TestSwapDepositPanel
        vaultAddress={snap.vault}
        chainId={snap.chainId}
        pauseAll={snap.pauseAll}
        pauseDeposits={snap.pauseDeposits}
      />

      <section className="grid-metrics">
        <Metric label="Total NAV (1e18)" value={formatNav1e18(snap.totalNAV1e18, 2)} sub="USD-scale in contract" />
        <Metric
          label="Share supply"
          value={formatUnits(snap.totalSupply, 18)}
          sub={snap.vaultSymbol}
        />
        <Metric label="Cycle id" value={String(snap.cycleId)} sub="closeCycle increments" />
        <Metric
          label="Executor"
          value={shortAddr(snap.executor, 6)}
          sub={
            <ExplorerLink chainId={snap.chainId} path={`/address/${snap.executor}`}>
              View on explorer
            </ExplorerLink>
          }
        />
      </section>

      <section className="panel">
        <h2>Pause flags</h2>
        <div className="pause-row">
          <PausePill on={snap.pauseAll} label="pauseAll" />
          <PausePill on={snap.pauseTrading} label="pauseTrading" />
          <PausePill on={snap.pauseDeposits} label="pauseDeposits" />
        </div>
        <p className="muted small">
          When <code>pauseAll</code> is on, deposits and rebalances stop; redemptions follow vault rules. See{" "}
          <code>DAOVault.sol</code> modifiers.
        </p>
      </section>

      <section className="panel">
        <h2>Access control</h2>
        <RolesTable snap={snap} />
      </section>

      <section className="panel">
        <h2>Tracked assets</h2>
        <AssetsTable snap={snap} />
      </section>

      <section className="panel mono">
        <h2>Contract</h2>
        <p>
          <a className="ext" href={`${explorer}/address/${snap.vault}`} target="_blank" rel="noreferrer">
            {snap.vault}
          </a>
        </p>
      </section>
    </>
  );
}

function CycleManagementPanel({
  clock,
  quorumStats,
  quorumFraction,
}: {
  clock: ManagedClockPayload;
  quorumStats: QuorumStats | null;
  quorumFraction: number;
}) {
  const params = {
    genesisUnix: clock.genesisUnix,
    durationSec: clock.durationSec,
    votingSec: clock.votingSec,
    frozenSec: clock.frozenSec,
  };
  const [live, setLive] = useState(() => computeLiveManagedCycle(params));
  useEffect(() => {
    const tick = () => setLive(computeLiveManagedCycle(params));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [clock.genesisUnix, clock.durationSec, clock.votingSec, clock.frozenSec]);

  const nowSec = Math.floor(Date.now() / 1000);
  const elapsedInWindow = Math.max(0, Math.min(clock.durationSec, nowSec - live.cycleStartSec));
  const elapsedPct = clock.durationSec > 0 ? (elapsedInWindow / clock.durationSec) * 100 : 0;
  const votingZonePct = clock.durationSec > 0 ? (clock.votingSec / clock.durationSec) * 100 : 0;

  const quorumFillPct =
    quorumStats != null && quorumStats.quorumTarget > 1e-18
      ? Math.min(100, (quorumStats.participatingPower / quorumStats.quorumTarget) * 100)
      : 0;

  return (
    <div
      className={`voting-card voting-card--cycle ${live.phase === "voting" ? "phase-voting" : "phase-frozen"} ${
        quorumStats?.quorumMet ? "quorum-met" : ""
      }`}
    >
      <div className="voting-card__header voting-cycle-head">
        <h3>Cycle window</h3>
        <div className="mono sm voting-cycle-head-meta">
          #{live.index} · <span className="phase-pill">{live.phase}</span> · ends{" "}
          <strong>{formatCountdown(live.secondsUntilCycleEnd)}</strong>
        </div>
      </div>
      <div className="voting-card__body voting-cycle-grid">
        <div className="voting-cycle-progress-block">
          <div className="cycle-bar-caption muted small">
            Time in{" "}
            {clock.durationSec >= 60
              ? `${Math.max(1, Math.round(clock.durationSec / 60))}m`
              : `${clock.durationSec}s`}{" "}
            window · voting zone vs frozen
          </div>
          <div className="cycle-bar-wrap">
            <div className="cycle-bar-zones" aria-hidden>
              <div className="cycle-bar-zone cycle-bar-zone--vote" style={{ width: `${votingZonePct}%` }} />
              <div className="cycle-bar-zone cycle-bar-zone--frozen" />
            </div>
            <div className="cycle-bar-elapsed" style={{ width: `${elapsedPct}%` }} title={`${elapsedPct.toFixed(1)}% elapsed`} />
          </div>
          <div className="cycle-bar-foot muted small mono">
            {live.phase === "voting" ? (
              <>
                Voting closes in <strong>{formatCountdown(live.secondsUntilPhaseEnd)}</strong> · then{" "}
                {Math.round(clock.frozenSec / 60)}m frozen
              </>
            ) : (
              <>Frozen — next window in {formatCountdown(live.secondsUntilCycleEnd)}</>
            )}
          </div>
        </div>
        <div className="voting-quorum-block">
          <div className="quorum-heading muted small">Participation vs quorum</div>
          <div className="quorum-visual">
            <div
              className={`quorum-tower ${quorumStats?.quorumMet ? "quorum-tower--met" : ""}`}
              title={
                quorumStats
                  ? `${(quorumFraction * 100).toFixed(0)}% of eligible power required · ${quorumStats.votedCount}/${quorumStats.holderCount} holders voted`
                  : "Add share holders (deposits) to measure quorum"
              }
            >
              <div className="quorum-tower-target" />
              <div className="quorum-tower-fill" style={{ height: `${quorumFillPct}%` }} />
            </div>
            <div className="quorum-copy mono sm">
              {quorumStats && quorumStats.holderCount > 0 ? (
                <>
                  <div>
                    <span className="muted">Power in:</span> {quorumStats.participatingPower.toFixed(2)}
                  </div>
                  <div>
                    <span className="muted">Need:</span> {quorumStats.quorumTarget.toFixed(2)}
                  </div>
                  <div className={quorumStats.quorumMet ? "quorum-ok" : "quorum-warn"}>
                    {quorumStats.quorumMet ? "Quorum met" : "Below quorum"}
                  </div>
                </>
              ) : (
                <div className="muted">No holders in RPC scan — quorum N/A</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VotingPage({ snap }: { snap: VaultSnapshot }) {
  const votesQ = useQuery({
    queryKey: ["allocation-votes"],
    queryFn: fetchAllocationVotes,
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const trustQ = useQuery({
    queryKey: ["trust-scores"],
    queryFn: fetchTrustScores,
    staleTime: 30_000,
  });

  const data = votesQ.data;
  const trustMap = trustQ.data?.trustByVoter ?? {};

  const governance = useMemo(
    () => ({
      quorumFraction: data?.governance?.quorumFraction ?? 0.15,
      approvalThresholdFraction: data?.governance?.approvalThresholdFraction ?? 0.5,
    }),
    [data?.governance],
  );

  const quorumStats = useMemo(() => {
    if (snap.holders.length === 0) return null;
    return computeQuorumStats(
      snap,
      trustMap,
      governance.quorumFraction,
      votedAddressSet(snap.onChainAllocationBallots),
    );
  }, [snap, trustMap, governance.quorumFraction]);

  return (
    <section className="panel voting-page">
      <h2 className="voting-page-title">Allocation voting</h2>

      <div className="voting-layout">
        {votesQ.isLoading ? (
          <div className="voting-card voting-card--muted">
            <div className="voting-card__body">Loading cycle schedule…</div>
          </div>
        ) : null}

        {votesQ.isError ? (
          <div className="voting-card voting-card--muted">
            <div className="voting-card__body muted small">Voting schedule unavailable.</div>
          </div>
        ) : null}

        {!votesQ.isLoading && data?.managedClock ? (
          <CycleManagementPanel
            clock={data.managedClock}
            quorumStats={quorumStats}
            quorumFraction={governance.quorumFraction}
          />
        ) : null}

        {!votesQ.isLoading && !votesQ.isError && data && !data.managedClock ? (
          <div className="voting-card voting-card--muted">
            <div className="voting-card__body muted small">Wall-clock schedule unavailable.</div>
          </div>
        ) : null}

        <AllocationBallotPanel snap={snap} trustMap={trustMap} />
        <VotingTables snap={snap} trustMap={trustMap} />
      </div>
    </section>
  );
}

function VotingTables({
  snap,
  trustMap,
}: {
  snap: VaultSnapshot;
  trustMap: Record<string, number>;
}) {
  const onChainAgg = useMemo(() => computeOnChainTargets(snap, trustMap), [snap, trustMap]);
  const targetEntries = useMemo(
    () => Object.entries(onChainAgg.targets).sort((a, b) => b[1] - a[1]),
    [onChainAgg.targets],
  );
  const aggregatePieSegments = useMemo((): PieSegment[] => {
    return targetEntries.map(([addr, w]) => ({
      key: addr.toLowerCase(),
      label: assetSymbolForAddress(snap, addr),
      fraction: w,
    }));
  }, [targetEntries, snap]);
  const holderRows = useMemo(() => buildHolderVoteRows(snap, trustMap), [snap, trustMap]);

  return (
    <>
      <div className="voting-card">
        <div className="voting-card__header">
          <h3>Aggregate targets</h3>
        </div>
        <div className="voting-card__body">
          {onChainAgg.warnings.length > 0 ? (
            <ul className="muted small" style={{ margin: "0 0 1rem", paddingLeft: "1.25rem" }}>
              {onChainAgg.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {onChainAgg.ballotCount > 0 ? (
            <p className="muted small mono" style={{ margin: "0 0 1rem" }}>
              <strong>{onChainAgg.ballotCount}</strong> ballot{onChainAgg.ballotCount === 1 ? "" : "s"} in blend · pooled
              voting power <strong>{onChainAgg.votingPowerSum.toFixed(2)}</strong> (trust × shares)
            </p>
          ) : null}
          <div className="voting-aggregate-split">
            {targetEntries.length > 0 ? (
              <AllocationPieChart
                segments={aggregatePieSegments}
                title="On-chain blend"
                size={184}
                className="voting-aggregate-pie"
              />
            ) : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {targetEntries.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="muted mono">
                        —
                      </td>
                    </tr>
                  ) : (
                    targetEntries.map(([addr, w]) => (
                      <tr key={addr}>
                        <td>
                          <span className="asset-name">
                            <span className="asset-weight mono" title="Target allocation">
                              {pctFromFraction(w)}
                            </span>
                            <span>{assetSymbolForAddress(snap, addr)}</span>
                          </span>
                          <ExplorerLink chainId={snap.chainId} path={`/token/${addr}`}>
                            {shortAddr(addr, 5)}
                          </ExplorerLink>
                        </td>
                        <td className="mono">{w.toFixed(6)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="voting-card">
        <div className="voting-card__header">
          <h3>Share holders & on-chain ballots</h3>
        </div>
        <div className="voting-card__body">
          {snap.holders.length === 0 ? (
            <div className="muted empty-hint">
              No share holders in this scan — widen <code>VITE_HOLDER_LOGS_FROM_BLOCK</code> or deposit.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Holder</th>
                    <th>Status</th>
                    <th>Trust</th>
                    <th>Shares</th>
                    <th>Power</th>
                    <th>Weights</th>
                  </tr>
                </thead>
                <tbody>
                  {holderRows.map((row) => {
                    const trustClass =
                      row.trustIsDefault ? "trust-score trust-default" : row.trust >= 1.01 ? "trust-score trust-high" : row.trust <= 0.99 ? "trust-score trust-low" : "trust-score";
                    const bps = row.weightsBps;
                    const bpsOk = bps && bps.length === snap.ballotAssets.length;
                    return (
                      <tr key={row.address}>
                        <td className="mono">
                          <ExplorerLink chainId={snap.chainId} path={`/address/${row.address}`}>
                            {row.address}
                          </ExplorerLink>
                        </td>
                        <td>
                          {row.voted ? (
                            <span className="vote-status vote-status--ok" title={`Ballot events filtered for vault cycleId ${snap.cycleId}`}>
                              Voted · vault cycle {snap.cycleId.toString()}
                            </span>
                          ) : (
                            <span className="vote-status vote-status--pending">No ballot</span>
                          )}
                        </td>
                        <td className={`mono sm ${trustClass}`}>{row.trust.toFixed(3)}</td>
                        <td className="mono sm">{row.sharesLabel}</td>
                        <td className="mono sm">{row.displayPower.toFixed(4)}</td>
                        <td className="ballot-weights">
                          {row.voted && bpsOk ? (
                            <ul className="ballot-weight-list">
                              {snap.ballotAssets.map((asset, i) => (
                                <li key={asset.address}>
                                  <span className="mono sm">{assetSymbolForAddress(snap, asset.address)}</span>{" "}
                                  <span className="mono muted">{pctFromFraction((bps[i] ?? 0) / 10_000)}</span>
                                </li>
                              ))}
                            </ul>
                          ) : row.voted && !bpsOk ? (
                            <span className="muted sm">Malformed ballot (asset count)</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function UsersPage({ snap }: { snap: VaultSnapshot }) {
  const trustQ = useQuery({
    queryKey: ["trust-scores"],
    queryFn: fetchTrustScores,
    staleTime: 30_000,
  });

  const trustMap = trustQ.data?.trustByVoter ?? {};

  return (
    <section className="panel">
      <h2>Vault users (share holders)</h2>
      <p className="muted small trust-scores-hint">
        <strong>Trust score</strong> is off-chain v0 (same multipliers as aggregate). Missing addresses use default{" "}
        <strong>1.00</strong>.
      </p>
      {trustQ.isLoading ? <p className="muted small">Loading trust scores…</p> : null}
      {trustQ.isError ? (
        <p className="muted small">Trust scores file missing or invalid — trust column shows defaults only.</p>
      ) : null}
      {trustQ.data?._meta?.updatedAt ? (
        <p className="muted small">
          Trust data updated: {trustQ.data._meta.updatedAt}
          {trustQ.data._meta.scoringRule ? ` · rule: ${trustQ.data._meta.scoringRule}` : null}
        </p>
      ) : null}
      {snap.holders.length === 0 ? (
        <p className="muted">No share holders found in the current log scan window.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th title="Trust multiplier (voting power in aggregate)">Trust</th>
                <th title="Approx. shares × trust (informal influence)">Influence</th>
                <th>Shares</th>
                <th>Ownership</th>
                <th>Est. NAV claim</th>
              </tr>
            </thead>
            <tbody>
              {snap.holders.map((h) => {
                const ownershipBps =
                  snap.totalSupply > 0n ? (h.balance * 1_000_000n) / snap.totalSupply : 0n;
                const navClaim =
                  snap.totalSupply > 0n ? (snap.totalNAV1e18 * h.balance) / snap.totalSupply : 0n;
                const { score: trustScore, isDefault: trustIsDefault } = trustForAddress(trustMap, h.address);
                const sharesNum = Number(formatUnits(h.balance, 18));
                const influence = Number.isFinite(sharesNum) ? sharesNum * trustScore : 0;
                const trustClass =
                  trustIsDefault ? "trust-score trust-default" : trustScore >= 1.01 ? "trust-score trust-high" : trustScore <= 0.99 ? "trust-score trust-low" : "trust-score";
                return (
                  <tr key={h.address}>
                    <td className="mono">
                      <ExplorerLink chainId={snap.chainId} path={`/address/${h.address}`}>
                        {h.address}
                      </ExplorerLink>
                    </td>
                    <td className={`mono ${trustClass}`} title={trustIsDefault ? "Default trust (no CSV row)" : undefined}>
                      {trustScore.toFixed(2)}
                      {trustIsDefault ? " *" : ""}
                    </td>
                    <td className="mono sm">{influence.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                    <td className="mono">{formatUnits(h.balance, 18)}</td>
                    <td className="mono">{(Number(ownershipBps) / 10_000).toFixed(4)}%</td>
                    <td className="mono">{formatNav1e18(navClaim, 4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">* Default trust when wallet not listed in <code>trust-scores.json</code>.</p>
    </section>
  );
}
