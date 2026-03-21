import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { formatUnits, type Address } from "viem";
import { explorerBase } from "../lib/client";
import {
  fetchTrustScores,
  onChainBallotVoterSetFromSnap,
  trustForAddress,
  type TrustForAddressOpts,
} from "../lib/trustScores";
import { formatNav1e18, shortAddr, type VaultSnapshot } from "../lib/vault";

type SortKey = "trust" | "share" | "power";
type SortDir = "desc" | "asc";

type Row = {
  address: Address;
  trust: number;
  sharePct: number;
  power: number;
  balance: bigint;
  pendingTrustFinalize: boolean;
  trustIsDefault: boolean;
};

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

function trustClass(row: Row): string {
  if (row.pendingTrustFinalize) return "trust-score trust-pending";
  if (row.trustIsDefault) return "trust-score trust-default";
  if (row.trust >= 1.01) return "trust-score trust-high";
  if (row.trust <= 0.99) return "trust-score trust-low";
  return "trust-score";
}

function sortIndicator(active: boolean, dir: SortDir): string {
  if (!active) return "";
  return dir === "desc" ? "↓" : "↑";
}

/** trust × shares (human); balances can be huge → avoid 20-digit strings in the UI */
function formatVotingPower(power: number): string {
  if (!Number.isFinite(power)) return "—";
  if (power === 0) return "0";
  const a = Math.abs(power);
  if (a < 10_000) {
    return power.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  }
  if (a < 1e12) {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(power);
  }
  return power.toExponential(3);
}

export function TrustLeaderboardTab({ snap }: { snap: VaultSnapshot }) {
  const { address: wagmiAddr } = useAccount();
  const [manual, setManual] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("trust");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const trustQ = useQuery({
    queryKey: ["trust-scores"],
    queryFn: fetchTrustScores,
    staleTime: 30_000,
  });

  const trustMap = trustQ.data?.trustByVoter ?? {};
  const trustOpts = useMemo((): TrustForAddressOpts => {
    const off = (trustQ.data?._meta?.votersPendingTrustFinalize ?? []).map((a) => a.toLowerCase());
    return {
      onChainBallotVoters: onChainBallotVoterSetFromSnap(snap.onChainAllocationBallots),
      offChainBallotVotersPending: new Set(off),
    };
  }, [snap.onChainAllocationBallots, trustQ.data?._meta?.votersPendingTrustFinalize]);

  const effectiveYou = useMemo(() => {
    const m = manual.trim();
    if (m.startsWith("0x") && m.length >= 42) return m as Address;
    return wagmiAddr ?? null;
  }, [manual, wagmiAddr]);

  const baseRows = useMemo((): Row[] => {
    return snap.holders.map((h) => {
      const ownershipBps = snap.totalSupply > 0n ? (h.balance * 1_000_000n) / snap.totalSupply : 0n;
      const sharePct = Number(ownershipBps) / 10_000;
      const { score: trust, isDefault: trustIsDefault, pendingTrustFinalize } = trustForAddress(
        trustMap,
        h.address,
        trustOpts,
      );
      const sharesNum = Number(formatUnits(h.balance, 18));
      const power = Number.isFinite(sharesNum) ? sharesNum * trust : 0;
      return {
        address: h.address,
        trust,
        sharePct,
        power,
        balance: h.balance,
        pendingTrustFinalize: !!pendingTrustFinalize,
        trustIsDefault,
      };
    });
  }, [snap.holders, snap.totalSupply, trustMap, trustOpts]);

  const sortedRows = useMemo(() => {
    const out = [...baseRows];
    out.sort((a, b) => {
      const va = sortKey === "trust" ? a.trust : sortKey === "share" ? a.sharePct : a.power;
      const vb = sortKey === "trust" ? b.trust : sortKey === "share" ? b.sharePct : b.power;
      const c = sortDir === "desc" ? vb - va : va - vb;
      if (c !== 0) return c;
      return a.address.toLowerCase().localeCompare(b.address.toLowerCase());
    });
    return out;
  }, [baseRows, sortKey, sortDir]);

  const maxBar = useMemo(() => {
    if (sortedRows.length === 0) return 1;
    return Math.max(
      ...sortedRows.map((r) => (sortKey === "trust" ? r.trust : sortKey === "share" ? r.sharePct : r.power)),
      1e-12,
    );
  }, [sortedRows, sortKey]);

  const yourRank = useMemo(() => {
    if (!effectiveYou) return null;
    const k = normalizeAddr(effectiveYou);
    const idx = sortedRows.findIndex((r) => r.address.toLowerCase() === k);
    return idx >= 0 ? idx + 1 : null;
  }, [sortedRows, effectiveYou]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <section className="panel trust-lb">
      <header className="trust-lb__head">
        <div>
          <h2 className="trust-lb__title">Trust leaderboard</h2>
          {trustQ.data?._meta?.updatedAt ? (
            <span className="trust-lb__meta mono">{trustQ.data._meta.updatedAt}</span>
          ) : null}
        </div>
        <input
          className="trust-lb__input mono"
          placeholder="0x…"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </header>

      {effectiveYou && yourRank != null ? (
        <div className="trust-lb__you-rank">
          <span className="trust-lb__you-rank-num">#{yourRank}</span>
          <span className="muted small">of {sortedRows.length}</span>
        </div>
      ) : effectiveYou && yourRank == null ? (
        <div className="trust-lb__you-rank trust-lb__you-rank--off">
          <span className="muted small">Not in holder scan</span>
        </div>
      ) : null}

      {snap.holders.length === 0 ? (
        <p className="muted trust-lb__empty">No holders in scan</p>
      ) : (
        <>
          <div className="trust-lb__sort-row">
            <span className="muted small trust-lb__sort-label">Sort</span>
            <button
              type="button"
              className={`trust-lb__sort-btn ${sortKey === "trust" ? "trust-lb__sort-btn--on" : ""}`}
              onClick={() => toggleSort("trust")}
            >
              Trust {sortIndicator(sortKey === "trust", sortDir)}
            </button>
            <button
              type="button"
              className={`trust-lb__sort-btn ${sortKey === "share" ? "trust-lb__sort-btn--on" : ""}`}
              onClick={() => toggleSort("share")}
            >
              Share % {sortIndicator(sortKey === "share", sortDir)}
            </button>
            <button
              type="button"
              className={`trust-lb__sort-btn ${sortKey === "power" ? "trust-lb__sort-btn--on" : ""}`}
              onClick={() => toggleSort("power")}
            >
              Power {sortIndicator(sortKey === "power", sortDir)}
            </button>
          </div>

          <div className="trust-lb__list-head" aria-hidden>
            <span className="trust-lb__rank" />
            <span>Holder</span>
            <span className="trust-lb__col-h">Trust</span>
            <span className="trust-lb__col-h">Share</span>
            <span className="trust-lb__col-h">Power</span>
          </div>
          <ul className="trust-lb__list">
            {sortedRows.map((row, i) => {
              const rank = i + 1;
              const v = sortKey === "trust" ? row.trust : sortKey === "share" ? row.sharePct : row.power;
              const barPct = Math.min(100, (v / maxBar) * 100);
              const isYou = effectiveYou && row.address.toLowerCase() === normalizeAddr(effectiveYou);
              return (
                <li
                  key={row.address}
                  className={`trust-lb__item ${isYou ? "trust-lb__item--you" : ""} ${
                    !isYou && rank <= 3 ? `trust-lb__item--medal trust-lb__item--medal-${rank}` : ""
                  }`}
                >
                  <span className="trust-lb__rank mono">{rank}</span>
                  <div className="trust-lb__bar-cell">
                    <div className="trust-lb__bar-track">
                      <div className="trust-lb__bar-fill" style={{ width: `${barPct}%` }} />
                    </div>
                    <div className="trust-lb__addr-row">
                      <ExplorerLink chainId={snap.chainId} path={`/address/${row.address}`}>
                        {shortAddr(row.address, 10)}
                      </ExplorerLink>
                      {isYou ? <span className="trust-lb__you-pill">you</span> : null}
                    </div>
                  </div>
                  <div className={`trust-lb__metric mono sm ${trustClass(row)}`}>
                    {row.trust.toFixed(2)}
                    {row.pendingTrustFinalize ? "†" : row.trustIsDefault ? "*" : ""}
                  </div>
                  <div className="trust-lb__metric mono sm">{row.sharePct.toFixed(4)}%</div>
                  <div
                    className="trust-lb__metric mono sm trust-lb__metric--power"
                    title={Number.isFinite(row.power) ? row.power.toExponential(6) : undefined}
                  >
                    {formatVotingPower(row.power)}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="trust-lb__legend muted small mono">
            <span>† pending finalize</span>
            <span>* default trust</span>
            <span>NAV {formatNav1e18(snap.totalNAV1e18, 2)}</span>
          </div>
        </>
      )}
    </section>
  );
}
