/**
 * One-shot: executor calls DAOVault.rebalance with Uniswap V3 SwapRouter02 exactInputSingle (WETH → USDC).
 * Requires repo-root .env: CHAIN_RPC_URL, CHAIN_ID (optional), VAULT_ADDRESS, EXECUTOR_PRIVATE_KEY.
 *
 * Protections (when enabled):
 * - Compare vault oracle WETH/USD vs pool mid implied USDC/WETH; abort if deviation too large.
 * - Set amountOutMinimum from pool mid (+ fee fudge) minus slippage bps — not a full Quoter simulation.
 *
 * Env:
 * - REBALANCE_BPS (default 5000): fraction of vault WETH to swap.
 * - REBALANCE_DISABLE_ORACLE_POOL_GUARD=1: skip oracle vs pool check (e.g. rough testnet pools).
 * - REBALANCE_ORACLE_POOL_MAX_DEVIATION_BPS (default 2000): max |oracle-pool|/oracle, in bps.
 * - REBALANCE_SLIPPAGE_BPS (default 100): tightens amountOutMinimum vs mid estimate.
 * - REBALANCE_FEE_FUDGE_NUM/DEN (default 997/1000): ~0.3% v3 fee approximation on one hop.
 */
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { repoRoot, requireEnv } from "./lib/env.mjs";
import { sortTokens, sqrtPriceX96ToRatioToken1PerToken0, usdcPerEthFromRatio } from "./lib/poolMidPrice.mjs";

const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const FEE = 3000;

const vaultAbi = parseAbi(["function rebalance((address tokenIn, address router, bytes data)[] steps) external"]);
const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

const routerAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);

const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);
const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint8,bool)",
]);

function parsePk(raw) {
  const s = raw.trim();
  return s.startsWith("0x") ? s : `0x${s}`;
}

function loadSepoliaUniswap() {
  const yamlPath = path.join(repoRoot, "config/chain/base_sepolia.yaml");
  const doc = parseYaml(fs.readFileSync(yamlPath, "utf8"));
  const factory = doc.uniswap?.v3_factory;
  const router = doc.uniswap?.swap_router02;
  if (!factory || !router) throw new Error("base_sepolia.yaml: need uniswap.v3_factory + swap_router02");
  return { factory, router };
}

async function main() {
  const rpcUrl = requireEnv("CHAIN_RPC_URL");
  const vault = requireEnv("VAULT_ADDRESS");
  const pk = parsePk(requireEnv("EXECUTOR_PRIVATE_KEY"));
  const chainId = Number(process.env.CHAIN_ID ?? "84532");
  if (chainId !== 84532) throw new Error("rebalance.mjs expects CHAIN_ID=84532 (Base Sepolia) for now");

  const bps = Number(process.env.REBALANCE_BPS ?? "5000");
  if (bps <= 0 || bps > 10_000) throw new Error("REBALANCE_BPS must be 1..10000");

  const guardOff =
    process.env.REBALANCE_DISABLE_ORACLE_POOL_GUARD === "1" ||
    process.env.REBALANCE_DISABLE_ORACLE_POOL_GUARD === "true";
  const maxDevBps = Number(process.env.REBALANCE_ORACLE_POOL_MAX_DEVIATION_BPS ?? "2000");
  const slipBps = Number(process.env.REBALANCE_SLIPPAGE_BPS ?? "100");
  const feeNum = BigInt(process.env.REBALANCE_FEE_FUDGE_NUM ?? "997");
  const feeDen = BigInt(process.env.REBALANCE_FEE_FUDGE_DEN ?? "1000");

  if (!guardOff && (maxDevBps < 0 || maxDevBps > 10_000)) {
    throw new Error("REBALANCE_ORACLE_POOL_MAX_DEVIATION_BPS must be 0..10000");
  }
  if (slipBps < 0 || slipBps >= 10_000) throw new Error("REBALANCE_SLIPPAGE_BPS must be 0..9999");

  const { factory, router: SWAP_ROUTER02 } = loadSepoliaUniswap();

  const chain = baseSepolia;
  const account = privateKeyToAccount(pk);

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  const execOnChain = await publicClient.readContract({
    address: vault,
    abi: parseAbi(["function executor() view returns (address)"]),
    functionName: "executor",
  });

  if (execOnChain.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(
      `EXECUTOR_PRIVATE_KEY maps to ${account.address} but vault.executor() is ${execOnChain}`,
    );
  }

  const wethPrice1e18 = await publicClient.readContract({
    address: vault,
    abi: parseAbi(["function pricePerFullToken1e18(address) view returns (uint256)"]),
    functionName: "pricePerFullToken1e18",
    args: [WETH],
  });

  if (wethPrice1e18 === 0n) throw new Error("Vault oracle WETH price is 0 — fix feeds before rebalance");

  const wethBal = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [vault],
  });

  if (wethBal === 0n) throw new Error("Vault WETH balance is 0 — nothing to swap");

  const amountIn = (wethBal * BigInt(bps)) / 10_000n;
  if (amountIn === 0n) throw new Error(`Amount to swap rounds to 0 (balance ${wethBal}, bps ${bps})`);

  const [t0, t1] = sortTokens(USDC, WETH);
  const pool = await publicClient.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "getPool",
    args: [t0, t1, FEE],
  });
  if (pool === "0x0000000000000000000000000000000000000000") {
    throw new Error("No Uniswap v3 pool for USDC/WETH at fee tier " + FEE);
  }

  const [sqrtPriceX96] = await publicClient.readContract({
    address: pool,
    abi: poolAbi,
    functionName: "slot0",
  });

  const ratio = sqrtPriceX96ToRatioToken1PerToken0(sqrtPriceX96);
  const poolUsdcPerEth = usdcPerEthFromRatio(ratio);
  const oracleUsdcPerEth = Number(wethPrice1e18) / 1e18;

  let deviationBps = 0;
  if (oracleUsdcPerEth > 0 && poolUsdcPerEth > 0) {
    deviationBps = Math.round(
      (Math.abs(oracleUsdcPerEth - poolUsdcPerEth) / oracleUsdcPerEth) * 10_000,
    );
  }

  if (!guardOff) {
    if (deviationBps > maxDevBps) {
      throw new Error(
        `Oracle vs pool divergence too high: oracle ~$${oracleUsdcPerEth.toFixed(2)}/ETH, pool mid ~$${poolUsdcPerEth.toFixed(2)}/ETH (${deviationBps} bps > max ${maxDevBps} bps). ` +
          `Set REBALANCE_DISABLE_ORACLE_POOL_GUARD=1 to bypass (testnet only), or fix oracles / pool route.`,
      );
    }
  }

  // token0=USDC, token1=WETH: ratio = wei WETH per 1 micro-USDC; micro-USDC out ~ (amountIn * feeNum/feeDen) / ratio
  let amountOutMinimum = 0n;
  if (ratio > 0n) {
    const rawMidOut = (amountIn * feeNum) / (feeDen * ratio);
    amountOutMinimum = (rawMidOut * BigInt(10_000 - slipBps)) / 10_000n;
  }

  const data = encodeFunctionData({
    abi: routerAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: WETH,
        tokenOut: USDC,
        fee: FEE,
        recipient: vault,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const steps = [{ tokenIn: WETH, router: SWAP_ROUTER02, data }];

  const hash = await walletClient.writeContract({
    address: vault,
    abi: vaultAbi,
    functionName: "rebalance",
    args: [steps],
  });

  console.log(
    JSON.stringify(
      {
        txHash: hash,
        explorer: `https://sepolia.basescan.org/tx/${hash}`,
        vault,
        executor: account.address,
        guards: {
          oraclePoolGuardDisabled: guardOff,
          oracleUsdcPerEth: oracleUsdcPerEth,
          poolMidUsdcPerEth: poolUsdcPerEth,
          deviationBps,
          maxDeviationBps: guardOff ? null : maxDevBps,
        },
        swap: {
          tokenIn: WETH,
          amountIn: amountIn.toString(),
          amountInWeth: Number(amountIn) / 1e18,
          bps,
          router: SWAP_ROUTER02,
          amountOutMinimum: amountOutMinimum.toString(),
          slippageBps: slipBps,
          note: "amountOutMinimum from pool mid + fee fudge; use Uniswap Quoter for production tightness",
        },
      },
      null,
      2,
    ),
  );

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`rebalance reverted (status ${receipt.status})`);
  }
  console.log(
    JSON.stringify({
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
