import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  type Address,
  formatEther,
  formatUnits,
  maxUint256,
  parseEther,
} from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { baseSepolia } from "wagmi/chains";
import { useAccount, useBalance, usePublicClient, useWriteContract } from "wagmi";
import { daovaultAbi, erc20Abi, weth9Abi } from "../lib/abi";
import { SWAP_ROUTER02, UNISWAP_POOL_FEE_WETH_USDC } from "../lib/contracts";
import { swapRouter02Abi } from "../lib/swapRouter02Abi";
import { TOKENS } from "../lib/tokens";

type Props = {
  vaultAddress: Address;
  chainId: number;
  pauseAll?: boolean;
  pauseDeposits?: boolean;
};

/**
 * TEST ONLY: wrap ETH → swap WETH→USDC on Uniswap v3 → deposit USDC into vault.
 * Uses `amountOutMinimum = 0` — unsafe for prod; for hackathon / illiquid testnet pools.
 */
export function TestSwapDepositPanel({ vaultAddress, chainId, pauseAll, pauseDeposits }: Props) {
  const queryClient = useQueryClient();
  const { address, isConnected, chainId: walletChain } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const wrongChain = isConnected && walletChain !== undefined && walletChain !== baseSepolia.id;
  const depositsPaused = pauseAll === true || pauseDeposits === true;

  const { data: ethBal } = useBalance({
    address,
    chainId: baseSepolia.id,
    query: { enabled: !!address && !wrongChain },
  });

  const amountWei = useMemo(() => {
    const t = amountStr.trim();
    if (!t) return null;
    try {
      return parseEther(t);
    } catch {
      return null;
    }
  }, [amountStr]);

  const invalidateVault = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["vault"] });
    await queryClient.refetchQueries({ queryKey: ["vault"] });
  }, [queryClient]);

  async function waitSuccess(hash: `0x${string}`, label: string) {
    if (!publicClient) throw new Error("No RPC client");
    const r = await waitForTransactionReceipt(publicClient, { hash });
    if (r.status !== "success") throw new Error(`${label} failed (${r.status})`);
  }

  const onTest = async () => {
    if (!address || !publicClient || amountWei == null || amountWei === 0n) return;
    if (depositsPaused) {
      setErr("Deposits paused.");
      return;
    }
    if (ethBal && amountWei > ethBal.value) {
      setErr("Not enough ETH.");
      return;
    }
    setErr(null);
    try {
      setStatus("TEST 1/5 — Wrap ETH → WETH…");
      const h1 = await writeContractAsync({
        address: TOKENS.WETH.address,
        abi: weth9Abi,
        functionName: "deposit",
        value: amountWei,
        chainId: baseSepolia.id,
      });
      await waitSuccess(h1, "Wrap");

      setStatus("TEST 2/5 — Approve router (WETH)…");
      const h2 = await writeContractAsync({
        address: TOKENS.WETH.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [SWAP_ROUTER02, maxUint256],
        chainId: baseSepolia.id,
      });
      await waitSuccess(h2, "Approve router");

      const usdcBefore = await publicClient.readContract({
        address: TOKENS.USDC.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });

      setStatus("TEST 3/5 — Swap WETH → USDC (Uniswap)…");
      const h3 = await writeContractAsync({
        address: SWAP_ROUTER02,
        abi: swapRouter02Abi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: TOKENS.WETH.address,
            tokenOut: TOKENS.USDC.address,
            fee: UNISWAP_POOL_FEE_WETH_USDC,
            recipient: address,
            amountIn: amountWei,
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          },
        ],
        chainId: baseSepolia.id,
      });
      await waitSuccess(h3, "Swap");

      const usdcAfter = await publicClient.readContract({
        address: TOKENS.USDC.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      const usdcGain = usdcAfter - usdcBefore;
      if (usdcGain <= 0n) {
        throw new Error("Swap returned no USDC (pool liquidity / fee tier?). You may still hold WETH.");
      }

      setStatus(`TEST 4/5 — Approve vault (${formatUnits(usdcGain, TOKENS.USDC.decimals)} USDC)…`);
      const h4 = await writeContractAsync({
        address: TOKENS.USDC.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [vaultAddress, maxUint256],
        chainId: baseSepolia.id,
      });
      await waitSuccess(h4, "Approve USDC");

      setStatus("TEST 5/5 — Vault deposit(USDC)…");
      const h5 = await writeContractAsync({
        address: vaultAddress,
        abi: daovaultAbi,
        functionName: "deposit",
        args: [TOKENS.USDC.address, usdcGain, address],
        chainId: baseSepolia.id,
      });
      await waitSuccess(h5, "Deposit");

      setStatus(`TEST OK — deposited ${formatUnits(usdcGain, TOKENS.USDC.decimals)} USDC (from ${formatEther(amountWei)} ETH path).`);
      setAmountStr("");
      await invalidateVault();
    } catch (e) {
      setStatus(null);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  if (chainId !== baseSepolia.id) return null;

  return (
    <section className="panel test-swap-panel">
      <h2>
        TEST — ETH → USDC swap → deposit
      </h2>
      <p className="muted small">
        <strong>Not production.</strong> Wraps your ETH, swaps <strong>WETH → USDC</strong> via Uniswap v3 router on Base Sepolia (
        <span className="mono">fee={UNISWAP_POOL_FEE_WETH_USDC}</span>, <strong>minOut = 0</strong>
        ), then <code>deposit(USDC)</code>. Fails if the pool has no liquidity. Connect in Deposit above first.
      </p>

      {!isConnected || !address ? (
        <p className="muted">Connect wallet (see Deposit section).</p>
      ) : wrongChain ? (
        <p className="muted">Switch wallet to Base Sepolia.</p>
      ) : depositsPaused ? (
        <p className="deposit-err">Deposits paused on-chain.</p>
      ) : (
        <>
          <div className="deposit-fields">
            <label className="dep-label">
              ETH amount
              <input
                className="dep-input"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 0.002"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
            </label>
          </div>
          <p className="muted small mono">ETH balance: {formatEther(ethBal?.value ?? 0n)}</p>
          <button
            type="button"
            className="btn btn-warn"
            disabled={isPending || amountWei == null || amountWei === 0n || (ethBal != null && amountWei > ethBal.value)}
            onClick={onTest}
          >
            {isPending ? "Signing…" : "TEST — swap to USDC & deposit"}
          </button>
        </>
      )}

      {status ? <p className="deposit-status">{status}</p> : null}
      {err ? <p className="deposit-err">{err}</p> : null}
    </section>
  );
}
