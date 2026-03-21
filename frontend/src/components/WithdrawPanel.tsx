import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Address, formatUnits, parseUnits } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { baseSepolia } from "wagmi/chains";
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
import {
  buildSingleAssetRedeemSteps,
  computeRedeemSlices,
} from "../lib/redeemSwapSteps";
import type { VaultSnapshot } from "../lib/vault";
import { formatContractRevert } from "../lib/vaultWriteErrors";

type Props = {
  snap: VaultSnapshot;
};

type Mode = "basket" | "single";

export function WithdrawPanel({ snap }: Props) {
  const queryClient = useQueryClient();
  const vaultAddress = snap.vault;
  const { address, isConnected, chainId: walletChain } = useAccount();
  const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [mode, setMode] = useState<Mode>("basket");
  const [amountStr, setAmountStr] = useState("");
  const [assetOut, setAssetOut] = useState<Address | "">("");
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const wrongChain = isConnected && walletChain !== undefined && walletChain !== baseSepolia.id;
  const redeemBlocked = snap.pauseAll === true;

  const { data: shareBal = 0n, refetch: refetchShares } = useReadContract({
    chainId: baseSepolia.id,
    address: vaultAddress,
    abi: daovaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !wrongChain },
  });

  const sharesWei = useMemo(() => {
    const t = amountStr.trim();
    if (!t) return null;
    try {
      return parseUnits(t, 18);
    } catch {
      return null;
    }
  }, [amountStr]);

  const slices = useMemo(() => {
    if (sharesWei == null || sharesWei === 0n || snap.totalSupply === 0n) return null;
    return computeRedeemSlices(snap.assets, sharesWei, snap.totalSupply);
  }, [snap.assets, snap.totalSupply, sharesWei]);

  const singleSteps = useMemo(() => {
    if (mode !== "single" || !assetOut || slices == null) return null;
    return buildSingleAssetRedeemSteps({
      vault: vaultAddress,
      assetOut,
      assets: snap.assets,
      slices,
    });
  }, [assetOut, mode, slices, snap.assets, vaultAddress]);

  const allowedOutAssets = useMemo(
    () => snap.assets.filter((a) => a.isAllowed),
    [snap.assets],
  );

  useEffect(() => {
    if (mode !== "single" || assetOut) return;
    const first = allowedOutAssets[0]?.address;
    if (first) setAssetOut(first);
  }, [allowedOutAssets, assetOut, mode]);

  const invalidateVault = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["vault"] });
    await queryClient.refetchQueries({ queryKey: ["vault"] });
  }, [queryClient]);

  async function waitSuccess(hash: `0x${string}`, label: string) {
    if (!publicClient) throw new Error("No RPC client");
    const r = await waitForTransactionReceipt(publicClient, { hash });
    if (r.status !== "success") throw new Error(`${label} failed (${r.status})`);
  }

  const onMax = () => {
    if (shareBal === 0n) return;
    setAmountStr(formatUnits(shareBal, 18));
  };

  const onRedeem = async () => {
    if (!address || !publicClient) return;
    if (redeemBlocked) {
      setErr("pauseAll is on — redeems are blocked.");
      return;
    }
    if (sharesWei == null || sharesWei === 0n) {
      setErr("Enter a share amount.");
      return;
    }
    if (sharesWei > shareBal) {
      setErr("Amount exceeds your vault share balance.");
      return;
    }
    if (snap.assets.length === 0) {
      setErr("No tracked assets in the vault.");
      return;
    }

    setErr(null);
    setStatus("Confirm in wallet…");

    try {
      if (mode === "basket") {
        const assetsHint = snap.assets.map((a) => a.address);
        const h = await writeContractAsync({
          address: vaultAddress,
          abi: daovaultAbi,
          functionName: "redeemProRata",
          args: [sharesWei, assetsHint],
          chainId: baseSepolia.id,
        });
        setStatus("Waiting for redeem…");
        await waitSuccess(h, "redeemProRata");
        setStatus(`Redeemed ${formatUnits(sharesWei, 18)} ${snap.vaultSymbol} (pro-rata basket).`);
      } else {
        if (!assetOut) {
          setErr("Pick an output token.");
          setStatus(null);
          return;
        }
        const built = buildSingleAssetRedeemSteps({
          vault: vaultAddress,
          assetOut,
          assets: snap.assets,
          slices: computeRedeemSlices(snap.assets, sharesWei, snap.totalSupply),
        });
        if (!built.ok) {
          setErr(built.reason);
          setStatus(null);
          return;
        }
        const stepTuples = built.steps.map(
          (s) => [s.tokenIn, s.router, s.data] as const,
        );
        const h = await writeContractAsync({
          address: vaultAddress,
          abi: daovaultAbi,
          functionName: "redeemToSingleAsset",
          args: [sharesWei, assetOut, 0n, stepTuples],
          chainId: baseSepolia.id,
        });
        setStatus("Waiting for redeem…");
        await waitSuccess(h, "redeemToSingleAsset");
        setStatus(`Redeemed ${formatUnits(sharesWei, 18)} ${snap.vaultSymbol} to one asset (minOut=0 testnet).`);
      }
      await refetchShares();
      await invalidateVault();
    } catch (e) {
      setStatus(null);
      setErr(formatContractRevert(daovaultAbi, e));
    }
  };

  const busy = isWriting || isSwitching;
  const canSubmit =
    isConnected &&
    !wrongChain &&
    !redeemBlocked &&
    shareBal > 0n &&
    sharesWei != null &&
    sharesWei > 0n &&
    (mode === "basket" || (assetOut && singleSteps?.ok));

  return (
    <section className="panel deposit-panel withdraw-panel">
      <h2>Withdraw (redeem shares)</h2>
      <p className="muted small">
        Burn vault shares and receive underlying tokens. <strong>Basket</strong> sends each tracked asset pro-rata.{" "}
        <strong>Single asset</strong> swaps other slices into your chosen token via allowlisted Uniswap{" "}
        <code className="mono">SwapRouter02</code> (auto path only for WETH+USDC on Base Sepolia;{" "}
        <code className="mono">minOut = 0</code> — testnet only).
      </p>

      {snap.chainId !== baseSepolia.id ? (
        <p className="deposit-err">Withdraw UI is wired for Base Sepolia ({baseSepolia.id}); this snapshot is chain {snap.chainId}.</p>
      ) : null}

      {redeemBlocked ? <p className="deposit-err">pauseAll — withdrawals disabled on-chain.</p> : null}

      {!isConnected ? (
        <div className="deposit-row">
          <button type="button" className="btn btn-primary" onClick={() => connect({ connector: connectors[0] })} disabled={isConnecting}>
            {isConnecting ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      ) : (
        <>
          <div className="deposit-row wallet-bar">
            <span className="mono muted">{address}</span>
            <button type="button" className="btn btn-ghost" onClick={() => disconnect()}>
              Disconnect
            </button>
            {wrongChain ? (
              <button type="button" className="btn btn-primary" onClick={() => switchChain({ chainId: baseSepolia.id })} disabled={isSwitching}>
                {isSwitching ? "Switching…" : "Switch to Base Sepolia"}
              </button>
            ) : null}
          </div>
          {connectError ? <p className="deposit-err">{connectError.message}</p> : null}
          {wrongChain ? <p className="deposit-err">Wrong network — switch to Base Sepolia to redeem.</p> : null}

          <div className="withdraw-mode">
            <label className="withdraw-mode__opt">
              <input
                type="radio"
                name="redeem-mode"
                checked={mode === "basket"}
                onChange={() => {
                  setMode("basket");
                  setErr(null);
                }}
              />
              Basket (pro-rata)
            </label>
            <label className="withdraw-mode__opt">
              <input
                type="radio"
                name="redeem-mode"
                checked={mode === "single"}
                onChange={() => {
                  setMode("single");
                  setErr(null);
                }}
              />
              Single asset
            </label>
          </div>

          {mode === "single" && allowedOutAssets.length > 0 ? (
            <div className="deposit-row">
              <label className="withdraw-label">
                Receive as
                <select
                  className="withdraw-select"
                  value={assetOut}
                  onChange={(e) => setAssetOut(e.target.value as Address)}
                >
                  <option value="">— select —</option>
                  {allowedOutAssets.map((a) => (
                    <option key={a.address} value={a.address}>
                      {a.symbol} ({a.name})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : mode === "single" ? (
            <p className="deposit-err">No allowlisted tracked assets — cannot pick output token.</p>
          ) : null}

          {mode === "single" && singleSteps && !singleSteps.ok ? (
            <p className="deposit-err">{singleSteps.reason}</p>
          ) : null}

          <div className="deposit-fields">
            <label className="withdraw-label">
              Share amount ({snap.vaultSymbol}, 18 decimals)
              <div className="deposit-amount-row">
                <input
                  type="text"
                  inputMode="decimal"
                  className="withdraw-input"
                  placeholder="0.0"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  disabled={wrongChain || redeemBlocked}
                />
                <button type="button" className="btn" onClick={onMax} disabled={wrongChain || redeemBlocked || shareBal === 0n}>
                  Max
                </button>
              </div>
            </label>
            <p className="hint small mono">
              Your balance: {formatUnits(shareBal, 18)} {snap.vaultSymbol}
            </p>
          </div>

          {slices && snap.assets.length > 0 ? (
            <div className="withdraw-preview">
              <p className="withdraw-preview__title">Approx. slice of vault balances (floor)</p>
              <ul className="withdraw-preview__list">
                {snap.assets.map((a, i) => (
                  <li key={a.address} className="mono sm">
                    {formatUnits(slices[i]!, a.decimals)} {a.symbol}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="deposit-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSubmit || busy}
              onClick={() => void onRedeem()}
            >
              {busy ? "Signing…" : mode === "basket" ? "Redeem basket" : "Redeem to one asset"}
            </button>
          </div>
        </>
      )}

      {status ? <p className="deposit-status">{status}</p> : null}
      {err ? <p className="deposit-err">{err}</p> : null}
    </section>
  );
}
