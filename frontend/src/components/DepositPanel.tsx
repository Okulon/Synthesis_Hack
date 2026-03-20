import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  type Address,
  formatEther,
  formatUnits,
  maxUint256,
  parseEther,
  parseUnits,
} from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { baseSepolia } from "wagmi/chains";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { daovaultAbi, erc20Abi, weth9Abi } from "../lib/abi";
import { TOKENS, isEthMode, type TokenKey } from "../lib/tokens";

type Props = {
  vaultAddress: Address;
  chainId: number;
  /** Pause flags from on-chain read — deposits revert when paused. */
  pauseAll?: boolean;
  pauseDeposits?: boolean;
};

function erc20Token(key: TokenKey) {
  if (isEthMode(key)) return TOKENS.WETH;
  return TOKENS[key];
}

export function DepositPanel({ vaultAddress, chainId, pauseAll, pauseDeposits }: Props) {
  const queryClient = useQueryClient();
  const { address, isConnected, chainId: walletChain } = useAccount();
  const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [tokenKey, setTokenKey] = useState<TokenKey>("ETH");
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const erc20 = erc20Token(tokenKey);

  const amountWei = useMemo(() => {
    const t = amountStr.trim();
    if (!t) return null;
    try {
      if (isEthMode(tokenKey)) return parseEther(t);
      return parseUnits(t, erc20.decimals);
    } catch {
      return null;
    }
  }, [amountStr, tokenKey, erc20.decimals]);

  const wrongChain = isConnected && walletChain !== undefined && walletChain !== baseSepolia.id;

  const { data: ethBal, refetch: refetchEthBal } = useBalance({
    address,
    chainId: baseSepolia.id,
    query: { enabled: !!address && !wrongChain && isEthMode(tokenKey) },
  });

  const { data: balance = 0n, refetch: refetchBal } = useReadContract({
    chainId: baseSepolia.id,
    address: erc20.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !wrongChain && !isEthMode(tokenKey) },
  });

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    chainId: baseSepolia.id,
    address: erc20.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, vaultAddress] : undefined,
    query: { enabled: !!address && !wrongChain },
  });

  const needsApprove =
    !isEthMode(tokenKey) && amountWei != null && amountWei > 0n && allowance < amountWei;

  const invalidateVault = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["vault"] });
    await queryClient.refetchQueries({ queryKey: ["vault"] });
  }, [queryClient]);

  async function waitForSuccess(hash: `0x${string}`, label: string) {
    if (!publicClient) throw new Error("No public client");
    const receipt = await waitForTransactionReceipt(publicClient, { hash });
    if (receipt.status !== "success") {
      throw new Error(`${label} failed on-chain (receipt status: ${receipt.status}).`);
    }
  }

  const onApprove = async () => {
    if (!address || !publicClient || amountWei == null || amountWei === 0n) return;
    setErr(null);
    setStatus("Confirm approve in wallet…");
    try {
      const hash = await writeContractAsync({
        address: erc20.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [vaultAddress, maxUint256],
        chainId: baseSepolia.id,
      });
      setStatus("Waiting for approval…");
      await waitForSuccess(hash, "Approve");
      setStatus("Approved.");
      await refetchAllowance();
    } catch (e) {
      setStatus(null);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const onDeposit = async () => {
    if (!address || !publicClient || amountWei == null || amountWei === 0n) return;
    setErr(null);
    setStatus("Confirm deposit in wallet…");
    try {
      if (allowance < amountWei) {
        setErr("Allowance too low — approve first.");
        return;
      }
      const hash = await writeContractAsync({
        address: vaultAddress,
        abi: daovaultAbi,
        functionName: "deposit",
        args: [erc20.address, amountWei, address],
        chainId: baseSepolia.id,
      });
      setStatus("Waiting for deposit…");
      await waitForSuccess(hash, "Deposit");
      setStatus("Deposit confirmed.");
      setAmountStr("");
      await refetchBal();
      await refetchAllowance();
      await invalidateVault();
    } catch (e) {
      setStatus(null);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  /** Vault only accepts ERC-20: wrap ETH → WETH, approve, deposit (3 signatures). */
  const onDepositEth = async () => {
    if (!address || !publicClient || amountWei == null || amountWei === 0n) return;
    if (ethBal && amountWei > ethBal.value) {
      setErr("Not enough ETH in wallet for this amount (need ETH for wrapping, not only WETH).");
      return;
    }
    setErr(null);
    try {
      setStatus("1/3 — Wrap ETH → WETH (confirm in wallet)…");
      const h1 = await writeContractAsync({
        address: TOKENS.WETH.address,
        abi: weth9Abi,
        functionName: "deposit",
        value: amountWei,
        chainId: baseSepolia.id,
      });
      await waitForSuccess(h1, "Wrap ETH");

      setStatus("2/3 — Approve vault to spend WETH…");
      const h2 = await writeContractAsync({
        address: TOKENS.WETH.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [vaultAddress, maxUint256],
        chainId: baseSepolia.id,
      });
      await waitForSuccess(h2, "Approve WETH");

      setStatus("3/3 — Deposit into vault…");
      const h3 = await writeContractAsync({
        address: vaultAddress,
        abi: daovaultAbi,
        functionName: "deposit",
        args: [TOKENS.WETH.address, amountWei, address],
        chainId: baseSepolia.id,
      });
      await waitForSuccess(h3, "Deposit");

      setStatus("Deposit confirmed.");
      setAmountStr("");
      await refetchEthBal();
      await refetchAllowance();
      await invalidateVault();
    } catch (e) {
      setStatus(null);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const busy = isWriting || isConnecting || isSwitching;

  const depositsPaused = pauseAll === true || pauseDeposits === true;

  if (chainId !== baseSepolia.id) {
    return (
      <section className="panel">
        <h2>Deposit</h2>
        <p className="muted">Wallet deposits only work when the dashboard targets Base Sepolia (84532).</p>
      </section>
    );
  }

  const balanceLabel = isEthMode(tokenKey)
    ? `${formatEther(ethBal?.value ?? 0n)} ETH`
    : `${formatUnits(balance, erc20.decimals)} ${erc20.symbol}`;

  return (
    <section className="panel deposit-panel">
      <h2>Deposit</h2>
      <p className="muted small">
        Connect an injected wallet (e.g. <strong>Rabby</strong>), switch to <strong>Base Sepolia</strong>. The vault
        only accepts <strong>ERC-20</strong> (USDC/WETH). <strong>ETH</strong> here wraps to WETH first, then
        deposits.
      </p>

      {depositsPaused ? (
        <p className="deposit-err">
          Deposits are paused on-chain (<code>pauseAll</code> or <code>pauseDeposits</code>). Wait for governance.
        </p>
      ) : null}

      {!isConnected ? (
        <div className="deposit-row">
          {connectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => {
                setErr(null);
                connect({ connector: c, chainId: baseSepolia.id });
              }}
            >
              {isConnecting ? "Connecting…" : `Connect ${c.name}`}
            </button>
          ))}
          {connectError ? <p className="deposit-err">{connectError.message}</p> : null}
        </div>
      ) : (
        <>
          <div className="deposit-row wallet-bar">
            <span className="mono">{address}</span>
            <button type="button" className="btn" disabled={busy} onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>

          {wrongChain ? (
            <div className="deposit-row">
              <p className="muted">Wrong network. Switch to Base Sepolia.</p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSwitching}
                onClick={() => switchChain({ chainId: baseSepolia.id })}
              >
                {isSwitching ? "Switching…" : "Switch to Base Sepolia"}
              </button>
            </div>
          ) : (
            <>
              <div className={`deposit-fields ${depositsPaused ? "dep-disabled" : ""}`}>
                <label className="dep-label">
                  Asset
                  <select
                    className="dep-input"
                    value={tokenKey}
                    onChange={(e) => setTokenKey(e.target.value as TokenKey)}
                  >
                    <option value="ETH">ETH (wrap → WETH → deposit)</option>
                    <option value="WETH">WETH</option>
                    <option value="USDC">USDC</option>
                  </select>
                </label>
                <label className="dep-label">
                  Amount
                  <input
                    className="dep-input"
                    type="text"
                    inputMode="decimal"
                    placeholder={
                      tokenKey === "USDC" ? "e.g. 10" : tokenKey === "ETH" || tokenKey === "WETH" ? "e.g. 0.005" : "e.g. 0.01"
                    }
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                  />
                </label>
              </div>
              <p className="muted small mono">
                Wallet balance: {balanceLabel}
              </p>
              {isEthMode(tokenKey) ? (
                <p className="hint small">
                  Uses native <strong>ETH</strong> to mint <strong>WETH</strong>, then deposits into the vault (three
                  transactions in order).
                </p>
              ) : null}
              {amountWei === null && amountStr.trim() ? (
                <p className="deposit-err">Invalid amount</p>
              ) : null}

              <div className="deposit-actions">
                {isEthMode(tokenKey) ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      depositsPaused ||
                      busy ||
                      amountWei == null ||
                      amountWei === 0n ||
                      (ethBal != null && amountWei > ethBal.value)
                    }
                    onClick={onDepositEth}
                  >
                    {isWriting ? "Signing…" : "Deposit ETH (wrap + approve + vault)"}
                  </button>
                ) : (
                  <>
                    {needsApprove ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={depositsPaused || busy || amountWei == null || amountWei === 0n}
                        onClick={onApprove}
                      >
                        {isWriting ? "Signing…" : "1. Approve (unlimited)"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        depositsPaused || busy || amountWei == null || amountWei === 0n || needsApprove
                      }
                      onClick={onDeposit}
                    >
                      {isWriting ? "Signing…" : "2. Deposit"}
                    </button>
                  </>
                )}
              </div>
              {!isEthMode(tokenKey) && needsApprove && amountWei != null && amountWei > 0n ? (
                <p className="hint small">Approve once per token; then deposit any amount up to your balance.</p>
              ) : null}
            </>
          )}
        </>
      )}

      {status ? <p className="deposit-status">{status}</p> : null}
      {err ? <p className="deposit-err">{err}</p> : null}
    </section>
  );
}
