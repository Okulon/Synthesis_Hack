import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Abi, type Address, formatUnits } from "viem";
import { simulateContract, waitForTransactionReceipt } from "viem/actions";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { daovaultAbi } from "../lib/abi";
import { formatContractRevert } from "../lib/vaultWriteErrors";
import { trustForAddress } from "../lib/trustScores";
import { shortAddr, type VaultSnapshot } from "../lib/vault";
import { AllocationPieChart, type PieSegment } from "./AllocationPieChart";

/** `cast sig "castAllocationBallot(uint256[])"` — if missing from runtime bytecode, this vault predates the function. */
const CAST_ALLOCATION_BALLOT_SELECTOR_HEX = "d87de598";

type Props = {
  snap: VaultSnapshot;
  trustMap: Record<string, number>;
};

function equalPercents(n: number): string[] {
  if (n <= 0) return [];
  const baseBps = Math.floor(10_000 / n);
  const bps = Array.from({ length: n }, () => baseBps);
  bps[n - 1] = 10_000 - baseBps * (n - 1);
  return bps.map((b) => (b / 100).toFixed(2));
}

function weightsBpsToPctStrings(weightsBps: readonly number[], assetCount: number): string[] | null {
  if (weightsBps.length !== assetCount) return null;
  return weightsBps.map((b) => ((b / 10_000) * 100).toFixed(2));
}

/** Parse user % strings → bps (bigint); last index absorbs rounding so sum is exactly 10_000. */
function percentsToBps(pctStrings: string[]): bigint[] | null {
  const parsed = pctStrings.map((s) => {
    const x = Number.parseFloat(s.replace(",", "."));
    return Number.isFinite(x) ? x : NaN;
  });
  if (parsed.some((x) => Number.isNaN(x))) return null;
  if (parsed.some((x) => x < 0 || x > 100)) return null;
  const sum = parsed.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.02) return null;

  const bps = parsed.map((p) => BigInt(Math.round((p / 100) * 10_000)));
  const total = bps.reduce((a, b) => a + b, 0n);
  const drift = 10_000n - total;
  const out = [...bps];
  out[out.length - 1] = out[out.length - 1]! + drift;
  if (out.some((x) => x < 0n || x > 10_000n)) return null;
  if (out.reduce((a, b) => a + b, 0n) !== 10_000n) return null;
  return out;
}

export function AllocationBallotPanel({ snap, trustMap }: Props) {
  const queryClient = useQueryClient();
  const vault = snap.vault;
  const chainId = snap.chainId;

  const { address, isConnected, chainId: walletChain } = useAccount();
  const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const runtimeCodeQ = useQuery({
    queryKey: ["vault-runtime-code", vault, chainId],
    queryFn: () => publicClient!.getCode({ address: vault }),
    enabled: !!publicClient,
    staleTime: 120_000,
  });

  /**
   * null = not checked yet; true = heuristic pass; false = bytecode has no ballot selector (stale deploy).
   * Best for direct DAOVault creates; EIP-1967 proxies can false-negative.
   */
  const bytecodeHasBallotFn = useMemo(() => {
    const code = runtimeCodeQ.data;
    if (code === undefined) return null;
    if (!code || code === "0x") return false;
    return code.toLowerCase().includes(CAST_ALLOCATION_BALLOT_SELECTOR_HEX);
  }, [runtimeCodeQ.data]);

  /** Legacy vault: on-chain ballot uses tracked tokens only; allowlist can be wider (from `AssetAllowed` logs). */
  const allowlistedButNotInBallot = useMemo(() => {
    if (snap.ballotRegistryOnChain) return [];
    const ballotSet = new Set(snap.ballotAssets.map((a) => a.address.toLowerCase()));
    return snap.governanceAllowedAssets.filter((a) => !ballotSet.has(a.address.toLowerCase()));
  }, [snap.ballotRegistryOnChain, snap.ballotAssets, snap.governanceAllowedAssets]);

  const snapRef = useRef(snap);
  snapRef.current = snap;

  const n = snap.ballotAssets.length;
  const [pctStr, setPctStr] = useState<string[]>(() => equalPercents(n));
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const wrongChain = isConnected && walletChain !== undefined && walletChain !== chainId;

  const myBallot = useMemo(() => {
    if (!address) return undefined;
    const k = address.toLowerCase();
    return snap.onChainAllocationBallots.find((b) => b.voter.toLowerCase() === k);
  }, [address, snap.onChainAllocationBallots]);

  /** Bumps when the wallet’s saved on-chain ballot row changes (new vote / refetch). */
  const ballotSyncKey = useMemo(() => {
    if (!address) return `off-${n}`;
    if (!myBallot) return `new-${address.toLowerCase()}-${n}`;
    return `ok-${myBallot.blockNumber}-${myBallot.logIndex}-${myBallot.weightsBps.join(",")}`;
  }, [address, myBallot, n]);

  useEffect(() => {
    if (n <= 0) return;
    if (!address) {
      setPctStr(equalPercents(n));
      return;
    }
    const ballot = snapRef.current.onChainAllocationBallots.find(
      (b) => b.voter.toLowerCase() === address.toLowerCase(),
    );
    const fromChain =
      ballot && ballot.weightsBps.length === n ? weightsBpsToPctStrings(ballot.weightsBps, n) : null;
    if (fromChain) setPctStr(fromChain);
    else setPctStr(equalPercents(n));
  }, [address, n, ballotSyncKey]);

  const { data: ballotLenOnChain } = useReadContract({
    address: vault,
    abi: daovaultAbi,
    functionName: "ballotAssetsLength",
    chainId,
    query: { enabled: snap.ballotRegistryOnChain },
  });

  const { data: shareBal = 0n, refetch: refetchShares } = useReadContract({
    address: vault,
    abi: daovaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address && !wrongChain },
  });

  const ballotSlotsOnChain =
    ballotLenOnChain !== undefined ? Number(ballotLenOnChain) : n;
  const ballotMismatch =
    ballotLenOnChain !== undefined && Number(ballotLenOnChain) !== n;

  const hasShares = shareBal > 0n;

  const votingPower = useMemo(() => {
    if (!address || wrongChain) return null;
    const { score: trust } = trustForAddress(trustMap, address as Address);
    const shares = Number(formatUnits(shareBal, 18));
    return trust * shares;
  }, [address, wrongChain, trustMap, shareBal]);

  const bpsPreview = useMemo(() => percentsToBps(pctStr), [pctStr]);

  const ballotPieSegments = useMemo((): PieSegment[] => {
    if (n <= 0) return [];
    const bps = percentsToBps(pctStr);
    if (!bps) return [];
    return snap.ballotAssets.map((a, i) => ({
      key: a.address,
      label: a.symbol,
      fraction: Number(bps[i]!) / 10_000,
    }));
  }, [n, pctStr, snap.ballotAssets]);

  const matchesOnChain = useMemo(() => {
    if (!myBallot || myBallot.weightsBps.length !== n) return false;
    const fromForm = percentsToBps(pctStr);
    if (!fromForm) return false;
    return fromForm.every((b, i) => b === BigInt(myBallot.weightsBps[i]!));
  }, [myBallot, pctStr, n]);

  const sumPct = useMemo(() => {
    const parts = pctStr.map((s) => Number.parseFloat(s.replace(",", ".")));
    if (parts.some((x) => !Number.isFinite(x))) return null;
    return parts.reduce((a, b) => a + b, 0);
  }, [pctStr]);

  const invalidateVault = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["vault"] });
    await queryClient.refetchQueries({ queryKey: ["vault"] });
  }, [queryClient]);

  const waitOk = async (hash: `0x${string}`, label: string) => {
    if (!publicClient) throw new Error("No RPC client");
    const receipt = await waitForTransactionReceipt(publicClient, { hash });
    if (receipt.status !== "success") {
      throw new Error(`${label} reverted (receipt ${receipt.status}).`);
    }
  };

  const onSubmit = async () => {
    setErr(null);
    if (!address || wrongChain || !publicClient) return;
    if (snap.pauseAll) {
      setErr("Vault is paused (pauseAll).");
      return;
    }
    if (!hasShares) {
      setErr("Need vault shares to vote (deposit first).");
      return;
    }
    if (ballotMismatch) {
      setErr(
        `On-chain ballotAssetsLength is ${String(ballotLenOnChain)} but dashboard shows ${n} — refresh the page.`,
      );
      return;
    }
    if (bytecodeHasBallotFn === false) {
      setErr(
        "This vault bytecode has no castAllocationBallot — redeploy DAOVault (forge script) and set VITE_VAULT_ADDRESS.",
      );
      return;
    }
    const bps = percentsToBps(pctStr);
    if (!bps || bps.length !== ballotSlotsOnChain) {
      setErr("Weights must be valid percents 0–100 and sum to 100%.");
      return;
    }

    const abi = daovaultAbi as Abi;
    setStatus("Simulating…");
    try {
      await simulateContract(publicClient, {
        account: address,
        address: vault,
        abi,
        functionName: "castAllocationBallot",
        args: [bps],
      });
    } catch (e) {
      setErr(formatContractRevert(abi, e));
      setStatus(null);
      return;
    }

    setStatus("Confirm in wallet…");
    try {
      const hash = await writeContractAsync({
        address: vault,
        abi,
        functionName: "castAllocationBallot",
        args: [bps],
        chainId,
      });
      setStatus("Waiting for inclusion…");
      await waitOk(hash, "castAllocationBallot");
      setStatus(`Included · ${hash.slice(0, 10)}…`);
      await invalidateVault();
      await refetchShares();
    } catch (e) {
      setErr(formatContractRevert(abi, e));
      setStatus(null);
    }
  };

  const busy = isWriting || isConnecting || isSwitching;

  const submitLabel = myBallot ? "Update ballot" : "Submit ballot";

  return (
    <div className="voting-card allocation-ballot-panel">
      <div className="voting-card__header allocation-ballot-panel__head">
        <h3>Cast ballot</h3>
        {votingPower != null ? (
          <div className="mono sm allocation-ballot-panel__power">
            Power <strong>{votingPower.toFixed(4)}</strong>
          </div>
        ) : null}
      </div>
      <div className="voting-card__body">
        {bytecodeHasBallotFn === false ? (
          <p className="deposit-err" style={{ marginBottom: "0.75rem" }}>
            On-chain vault at {shortAddr(vault, 6)} is an <strong>older deploy</strong> (no{" "}
            <code className="mono">castAllocationBallot</code>). Redeploy with current{" "}
            <code className="mono">contracts/</code> and point <code className="mono">VITE_VAULT_ADDRESS</code> at the
            new address.
          </p>
        ) : null}
        {bytecodeHasBallotFn !== false && !snap.ballotRegistryOnChain ? (
          <div
            className="muted small"
            style={{
              marginBottom: "0.85rem",
              padding: "0.65rem 0.75rem",
              border: "1px solid var(--warn-border, #a88732)",
              borderRadius: "6px",
              background: "var(--warn-bg, rgba(168, 135, 50, 0.12))",
            }}
          >
            <strong style={{ display: "block", marginBottom: "0.35rem" }}>Legacy ballot layout</strong>
            This vault predates <code className="mono">ballotAssets</code> —{" "}
            <code className="mono">castAllocationBallot</code> only accepts one weight per <strong>tracked</strong>{" "}
            token (vault balance), not every allowlisted asset.
            {allowlistedButNotInBallot.length > 0 ? (
              <>
                {" "}
                Governance also allowlisted{" "}
                {allowlistedButNotInBallot.map((a, i) => (
                  <span key={a.address}>
                    {i > 0 ? ", " : null}
                    <span className="mono sm">{a.symbol}</span>
                  </span>
                ))}
                , but you cannot allocate votes to them on-chain until you{" "}
                <strong>redeploy DAOVault</strong> from current <code className="mono">contracts/</code> (then set{" "}
                <code className="mono">VITE_VAULT_ADDRESS</code>).
              </>
            ) : null}
          </div>
        ) : null}
        {!isConnected ? (
          <div className="deposit-actions" style={{ flexWrap: "wrap" }}>
            {connectors.map((c) => (
              <button
                key={c.uid}
                type="button"
                className="btn btn-primary"
                disabled={busy || !c.ready}
                onClick={() => connect({ connector: c, chainId })}
              >
                Connect {c.name}
              </button>
            ))}
            {connectError ? <p className="deposit-err">{connectError.message}</p> : null}
          </div>
        ) : (
          <>
            <div className="muted small mono" style={{ marginBottom: "0.75rem" }}>
              {address ? shortAddr(address as Address, 6) : ""}
              {wrongChain ? (
                <>
                  {" · "}
                  <span className="deposit-err">Wrong network</span>
                </>
              ) : null}
              {" · "}
              shares {formatUnits(shareBal, 18)}
            </div>
            {wrongChain ? (
              <div className="deposit-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => switchChain({ chainId })}
                >
                  Switch to chain {chainId}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => disconnect()}>
                  Disconnect
                </button>
              </div>
            ) : null}

            {!wrongChain && n === 0 ? (
              <p className="deposit-err">No ballot slots — governance has not allowlisted any assets yet.</p>
            ) : null}

            {!wrongChain && ballotMismatch ? (
              <p className="deposit-err" style={{ marginBottom: "0.75rem" }}>
                Chain reports {String(ballotLenOnChain)} ballot assets, UI {n} — refresh.
              </p>
            ) : null}

            {!wrongChain && n > 0 && myBallot && myBallot.weightsBps.length !== n ? (
              <p className="deposit-err" style={{ marginBottom: "0.75rem" }}>
                Ballot / asset count mismatch.
              </p>
            ) : null}

            {!wrongChain && n > 0 ? (
              <>
                {myBallot && myBallot.weightsBps.length === n ? (
                  <div className="allocation-ballot-current mono sm" style={{ marginBottom: "0.85rem" }}>
                    <span className="muted">Your vote · </span>
                    {snap.ballotAssets.map((a, i) => (
                      <span key={a.address}>
                        {a.symbol}{" "}
                        <strong>{((myBallot.weightsBps[i]! / 10_000) * 100).toFixed(2)}%</strong>
                        {i < n - 1 ? <span className="muted"> · </span> : null}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="allocation-ballot-chart-row">
                  <AllocationPieChart
                    segments={ballotPieSegments}
                    title="Preview"
                    size={168}
                    className="allocation-ballot-panel__pie"
                  />
                  <div className="allocation-ballot-chart-fields">
                    <div className="allocation-ballot-rows">
                      {snap.ballotAssets.map((asset, i) => (
                        <label key={asset.address} className="allocation-ballot-row">
                          <span className="allocation-ballot-label mono sm">
                            {asset.symbol}{" "}
                            <span className="muted">({shortAddr(asset.address, 4)})</span>
                          </span>
                          <div className="allocation-ballot-input-wrap">
                            <input
                              type="text"
                              inputMode="decimal"
                              className="allocation-ballot-input mono"
                              value={pctStr[i] ?? ""}
                              onChange={(e) => {
                                const next = [...pctStr];
                                next[i] = e.target.value;
                                setPctStr(next);
                              }}
                            />
                            <span className="muted sm">%</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="muted small mono" style={{ marginTop: "0.5rem" }}>
                  Sum:{" "}
                  {sumPct != null ? (
                    <strong className={Math.abs(sumPct - 100) > 0.02 ? "deposit-err" : ""}>
                      {sumPct.toFixed(2)}%
                    </strong>
                  ) : (
                    "—"
                  )}
                  {bpsPreview ? ` · ${bpsPreview.map((b) => String(b)).join(" / ")} bps` : null}
                </div>
                <div className="deposit-actions" style={{ marginTop: "1rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || snap.pauseAll || !hasShares}
                    onClick={() => setPctStr(equalPercents(n))}
                  >
                    Equal split
                  </button>
                  {myBallot && myBallot.weightsBps.length === n ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || snap.pauseAll || !hasShares || matchesOnChain}
                      onClick={() => {
                        const s = weightsBpsToPctStrings(myBallot.weightsBps, n);
                        if (s) setPctStr(s);
                      }}
                    >
                      Reset to on-chain
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      busy ||
                      snap.pauseAll ||
                      !hasShares ||
                      bytecodeHasBallotFn === false ||
                      ballotMismatch ||
                      bpsPreview == null ||
                      Math.abs((sumPct ?? 0) - 100) > 0.02 ||
                      matchesOnChain
                    }
                    title={matchesOnChain ? "Same as on-chain vote" : undefined}
                    onClick={() => void onSubmit()}
                  >
                    {isWriting ? "Sending…" : submitLabel}
                  </button>
                </div>
                {snap.pauseAll ? <p className="deposit-err">pauseAll is on — voting disabled on-chain.</p> : null}
                {!hasShares && !snap.pauseAll ? (
                  <p className="deposit-err">Deposit to receive shares before you can vote.</p>
                ) : null}
              </>
            ) : null}

            <div className="deposit-actions" style={{ marginTop: "0.75rem" }}>
              <button type="button" className="btn" disabled={busy} onClick={() => disconnect()}>
                Disconnect
              </button>
            </div>
          </>
        )}

        {status ? <p className="deposit-status">{status}</p> : null}
        {err ? <p className="deposit-err">{err}</p> : null}
      </div>
    </div>
  );
}
