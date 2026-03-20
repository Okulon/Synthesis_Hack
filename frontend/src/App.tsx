import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { formatUnits, type PublicClient } from "viem";
import { createVaultClient, explorerBase } from "./lib/client";
import { normalizeEnvString, parseVaultAddress } from "./lib/env";
import { DepositPanel } from "./components/DepositPanel";
import { TestSwapDepositPanel } from "./components/TestSwapDepositPanel";
import { fetchVaultSnapshot, formatNav1e18, shortAddr, type VaultSnapshot } from "./lib/vault";

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
            {`VITE_VAULT_ADDRESS=0xc738Fd6CD6CDe70e30F979fe62a0332ad37a5543`}
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
                <div className="asset-name">{a.name || a.symbol}</div>
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

export default function App() {
  const [view, setView] = useState<"dashboard" | "users">("dashboard");
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
    queryKey: ["vault", CHAIN_ID, VAULT_PARSED, RPC, ROLE_FROM_BLOCK?.toString() ?? "0"],
    queryFn: () =>
      fetchVaultSnapshot(client as unknown as PublicClient, VAULT_PARSED, {
        roleLogsFromBlock: ROLE_FROM_BLOCK,
        holderLogsFromBlock: HOLDER_FROM_BLOCK,
      }),
    refetchInterval: 20_000,
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

      {q.data ? (view === "dashboard" ? <Dashboard snap={q.data} /> : <UsersPage snap={q.data} />) : null}

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

function UsersPage({ snap }: { snap: VaultSnapshot }) {
  return (
    <section className="panel">
      <h2>Vault users (share holders)</h2>
      {snap.holders.length === 0 ? (
        <p className="muted">No share holders found in the current log scan window.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>Shares</th>
                <th>Ownership</th>
                <th>Est. NAV claim</th>
              </tr>
            </thead>
            <tbody>
              {snap.holders.map((h) => {
                const ownershipBps =
                  snap.totalSupply > 0n ? (h.balance * 1_000_000n) / snap.totalSupply : 0n; // 4dp percent
                const navClaim =
                  snap.totalSupply > 0n ? (snap.totalNAV1e18 * h.balance) / snap.totalSupply : 0n;
                return (
                  <tr key={h.address}>
                    <td className="mono">
                      <ExplorerLink chainId={snap.chainId} path={`/address/${h.address}`}>
                        {h.address}
                      </ExplorerLink>
                    </td>
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
    </section>
  );
}
