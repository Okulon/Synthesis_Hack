/**
 * Executor: DAOVault.rebalance via Uniswap V3 SwapRouter02.
 *
 * - **WETH↔USDC** single-hop (`exactInputSingle`) when drift is only between those two.
 * - **Hub routing** (hackathon minimum): optional third token in `config/chain/*.yaml` (e.g. cbETH on Base mainnet)
 *   — **WETH↔USDC↔extra** via `exactInput` path when moving between WETH and the extra token.
 *
 * Sizing: same NAV math as `npm run plan` — sells the **most overweight** asset toward the **most underweight**
 * among `would_trade` rows.
 *
 * Env: CHAIN_RPC_URL, VAULT_ADDRESS, EXECUTOR_PRIVATE_KEY, CHAIN_ID; REBALANCE_* guards/slippage/quoter as before.
 */
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseAbi,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

import { repoRoot, requireEnv } from "./lib/env.mjs";
import { sortTokens, sqrtPriceX96ToRatioToken1PerToken0, usdcPerEthFromRatio } from "./lib/poolMidPrice.mjs";
import { loadBands, loadTargets, fetchPlanRows, valueOf1e18 } from "./lib/planState.mjs";
import { encodeV3Path } from "./lib/uniswapPath.mjs";
import { buildHubRoute, routeTouchesWethUsdc3000 } from "./lib/rebalanceRoutes.mjs";

const WETH_USDC_FEE = 3000;
/** Fraction of overweight amount to trade this tx. */
const EXCESS_BPS = 10_000n;

const vaultAbi = parseAbi(["function rebalance((address tokenIn, address router, bytes data)[] steps) external"]);
const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"]);
const vaultPriceAbi = parseAbi(["function pricePerFullToken1e18(address) view returns (uint256)"]);

const routerSingleAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);
const routerPathAbi = parseAbi([
  "function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum)) payable returns (uint256 amountOut)",
]);

const quoterAbi = parseAbi([
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  "function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
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

function loadChainYaml(chainId) {
  const fname = chainId === 8453 ? "base.yaml" : chainId === 84532 ? "base_sepolia.yaml" : null;
  if (!fname) {
    throw new Error(`rebalance.mjs: unsupported CHAIN_ID ${chainId} (supported: 8453, 84532)`);
  }
  const yamlPath = path.join(repoRoot, "config/chain", fname);
  const doc = parseYaml(fs.readFileSync(yamlPath, "utf8"));
  const factory = doc.uniswap?.v3_factory;
  const router = doc.uniswap?.swap_router02;
  const quoter = doc.uniswap?.quoter_v2;
  const tokens = doc.tokens;
  if (!factory || !router) throw new Error(`${fname}: need uniswap.v3_factory + swap_router02`);
  if (!tokens?.WETH?.address || !tokens?.USDC?.address) {
    throw new Error(`${fname}: need tokens.WETH.address + tokens.USDC.address`);
  }

  const extras = [];
  for (const [sym, meta] of Object.entries(tokens)) {
    if (sym === "WETH" || sym === "USDC") continue;
    if (!meta?.address) continue;
    extras.push({
      symbol: sym,
      address: getAddress(meta.address),
      decimals: Number(meta.decimals ?? 18),
      usdcPoolFee: Number(meta.usdc_pool_fee ?? 3000),
    });
  }
  if (extras.length > 1) {
    console.warn("[rebalance] multiple extra tokens in yaml — using the first for hub routes only.");
  }

  return {
    factory,
    router: getAddress(router),
    quoterV2: quoter ? getAddress(quoter) : null,
    WETH: getAddress(tokens.WETH.address),
    USDC: getAddress(tokens.USDC.address),
    extra: extras[0] ?? null,
    fname,
  };
}

function pickViemChain(chainId) {
  if (chainId === 8453) return base;
  if (chainId === 84532) return baseSepolia;
  throw new Error(`rebalance.mjs: unsupported CHAIN_ID ${chainId}`);
}

function explorerTxUrl(chainId, hash) {
  if (chainId === 8453) return `https://basescan.org/tx/${hash}`;
  return `https://sepolia.basescan.org/tx/${hash}`;
}

function targetValue1e18(totalNAV, wTgt) {
  const wScaled = BigInt(Math.round(Number(wTgt) * 1e12));
  return (totalNAV * wScaled) / 1_000_000_000_000n;
}

function amountInForOverweight({ bal, price1e18, totalNAV, wTgt, decimals }) {
  const v = valueOf1e18(bal, price1e18, decimals);
  const tgtV = targetValue1e18(totalNAV, wTgt);
  if (v <= tgtV) return 0n;
  const excessValue = v - tgtV;
  const dec = BigInt(decimals);
  let amountIn = (excessValue * 10n ** dec) / price1e18;
  if (amountIn > bal) amountIn = bal;
  return (amountIn * EXCESS_BPS) / 10_000n;
}

function midUsdcOutFromWethIn(ratio, amountInWethWei, feeNum, feeDen, slipBps) {
  if (ratio === 0n) return 0n;
  const rawMidOut = (amountInWethWei * feeNum) / (feeDen * ratio);
  return (rawMidOut * BigInt(10_000 - slipBps)) / 10_000n;
}

function midWethOutFromUsdcIn(ratio, amountInUsdcAtomic, feeNum, feeDen, slipBps) {
  const rawMidOut = (amountInUsdcAtomic * ratio * feeNum) / feeDen;
  return (rawMidOut * BigInt(10_000 - slipBps)) / 10_000n;
}

function humanAmount(tokenIn, amountIn, WETH, USDC, decimals) {
  const t = tokenIn.toLowerCase();
  if (t === WETH.toLowerCase()) return Number(amountIn) / 1e18;
  if (t === USDC.toLowerCase()) return Number(amountIn) / 1e6;
  return Number(amountIn) / 10 ** decimals;
}

async function main() {
  const rpcUrl = requireEnv("CHAIN_RPC_URL");
  const vault = requireEnv("VAULT_ADDRESS");
  const pk = parsePk(requireEnv("EXECUTOR_PRIVATE_KEY"));
  const chainId = Number(process.env.CHAIN_ID ?? "84532");

  const guardEnv = process.env.REBALANCE_DISABLE_ORACLE_POOL_GUARD;
  const guardOff =
    guardEnv === "1" ||
    guardEnv === "true" ||
    (guardEnv === undefined && chainId === 84532);
  const maxDevBps = Number(process.env.REBALANCE_ORACLE_POOL_MAX_DEVIATION_BPS ?? "2000");
  const slipBps = Number(process.env.REBALANCE_SLIPPAGE_BPS ?? "100");
  const feeNum = BigInt(process.env.REBALANCE_FEE_FUDGE_NUM ?? "997");
  const feeDen = BigInt(process.env.REBALANCE_FEE_FUDGE_DEN ?? "1000");
  const useQuoter = process.env.REBALANCE_USE_QUOTER !== "0" && process.env.REBALANCE_USE_QUOTER !== "false";

  if (!guardOff && (maxDevBps < 0 || maxDevBps > 10_000)) {
    throw new Error("REBALANCE_ORACLE_POOL_MAX_DEVIATION_BPS must be 0..10000");
  }
  if (slipBps < 0 || slipBps >= 10_000) throw new Error("REBALANCE_SLIPPAGE_BPS must be 0..9999");

  const chainYaml = loadChainYaml(chainId);
  const { factory, router: SWAP_ROUTER02, quoterV2: quoterFromYaml, WETH, USDC, extra, fname } = chainYaml;
  const quoterEnv = process.env.REBALANCE_QUOTER_ADDRESS?.trim();
  const QUOTER = quoterEnv ? getAddress(quoterEnv) : quoterFromYaml;

  const routeReg = {
    WETH,
    USDC,
    extra: extra ? { address: extra.address, usdcPoolFee: extra.usdcPoolFee } : null,
  };

  const chain = pickViemChain(chainId);
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

  const bands = loadBands();
  if (bands.driftMetric !== "absolute_pp") {
    console.warn(`[rebalance] drift_metric=${bands.driftMetric} — only absolute_pp is implemented.`);
  }
  const { targets } = loadTargets();
  const { totalNAV, rows } = await fetchPlanRows(publicClient, vault, bands, targets);

  const anyTrade = rows.some((r) => r.decision === "would_trade");
  if (!anyTrade) {
    throw new Error("Plan: all assets within bands — nothing to rebalance.");
  }

  /** @type {Array<{ row: object; bal: bigint; price: bigint; decimals: number; excess: bigint }>} */
  const state = [];
  for (const row of rows) {
    const [bal, price, decimals] = await Promise.all([
      publicClient.readContract({
        address: row.asset,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [vault],
      }),
      publicClient.readContract({
        address: vault,
        abi: vaultPriceAbi,
        functionName: "pricePerFullToken1e18",
        args: [row.asset],
      }),
      publicClient.readContract({
        address: row.asset,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);
    if (price === 0n) {
      throw new Error(`Vault oracle price is 0 for ${row.symbol} (${row.asset})`);
    }
    const v = valueOf1e18(bal, price, Number(decimals));
    const tgtV = targetValue1e18(totalNAV, row.wTgt);
    state.push({
      row,
      bal,
      price,
      decimals: Number(decimals),
      excess: v - tgtV,
    });
  }

  const tradeStates = state.filter((s) => s.row.decision === "would_trade");
  const overs = tradeStates.filter((s) => s.excess > 0n);
  const unders = tradeStates.filter((s) => s.excess < 0n);
  if (overs.length === 0 || unders.length === 0) {
    throw new Error(
      "rebalance: need both an overweight and underweight asset with would_trade — check targets/bands.",
    );
  }

  const sell = overs.reduce((a, b) => (b.excess > a.excess ? b : a));
  const buy = unders.reduce((a, b) => (a.excess < b.excess ? a : b));

  const route = buildHubRoute(sell.row.asset, buy.row.asset, routeReg);

  const amountIn = amountInForOverweight({
    bal: sell.bal,
    price1e18: sell.price,
    totalNAV,
    wTgt: sell.row.wTgt,
    decimals: sell.decimals,
  });
  if (amountIn === 0n) {
    throw new Error("Overweight amount rounds to 0 — check NAV/oracles.");
  }

  const [t0, t1] = sortTokens(USDC, WETH);
  const wethUsdcPool = await publicClient.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "getPool",
    args: [t0, t1, WETH_USDC_FEE],
  });
  if (wethUsdcPool === "0x0000000000000000000000000000000000000000") {
    throw new Error("No Uniswap v3 pool for USDC/WETH at fee tier " + WETH_USDC_FEE);
  }

  const [sqrtPriceX96] = await publicClient.readContract({
    address: wethUsdcPool,
    abi: poolAbi,
    functionName: "slot0",
  });

  const ratio = sqrtPriceX96ToRatioToken1PerToken0(sqrtPriceX96);
  const poolUsdcPerEth = usdcPerEthFromRatio(ratio);
  const oracleUsdcPerEth = await publicClient
    .readContract({
      address: vault,
      abi: vaultPriceAbi,
      functionName: "pricePerFullToken1e18",
      args: [WETH],
    })
    .then((p) => Number(p) / 1e18);

  let deviationBps = 0;
  if (oracleUsdcPerEth > 0 && poolUsdcPerEth > 0) {
    deviationBps = Math.round(
      (Math.abs(oracleUsdcPerEth - poolUsdcPerEth) / oracleUsdcPerEth) * 10_000,
    );
  }

  const applyOracleGuard = routeTouchesWethUsdc3000(route, { WETH, USDC }) && !guardOff;
  if (applyOracleGuard && deviationBps > maxDevBps) {
    throw new Error(
      `Oracle vs pool divergence too high: oracle ~$${oracleUsdcPerEth.toFixed(2)}/ETH, pool mid ~$${poolUsdcPerEth.toFixed(2)}/ETH (${deviationBps} bps > max ${maxDevBps} bps). ` +
        `Set REBALANCE_DISABLE_ORACLE_POOL_GUARD=1 to bypass (testnet only), or fix oracles / pool route.`,
    );
  }

  let amountOutMinimum = 0n;
  let minOutSource = "mid_fudge";
  let steps;

  if (route.mode === "single") {
    if (useQuoter && QUOTER) {
      try {
        const q = await publicClient.readContract({
          address: QUOTER,
          abi: quoterAbi,
          functionName: "quoteExactInputSingle",
          args: [route.tokenIn, route.tokenOut, route.fee, amountIn, 0n],
        });
        const quotedOut = Array.isArray(q) ? q[0] : q.amountOut;
        amountOutMinimum = (quotedOut * BigInt(10_000 - slipBps)) / 10_000n;
        minOutSource = "quoter_v2";
      } catch (e) {
        console.warn("[rebalance] Quoter quoteExactInputSingle failed:", e?.message ?? e);
      }
    }

    if (minOutSource === "mid_fudge" && ratio > 0n) {
      if (route.tokenIn.toLowerCase() === WETH.toLowerCase() && route.tokenOut.toLowerCase() === USDC.toLowerCase()) {
        amountOutMinimum = midUsdcOutFromWethIn(ratio, amountIn, feeNum, feeDen, slipBps);
      } else if (
        route.tokenIn.toLowerCase() === USDC.toLowerCase() &&
        route.tokenOut.toLowerCase() === WETH.toLowerCase()
      ) {
        amountOutMinimum = midWethOutFromUsdcIn(ratio, amountIn, feeNum, feeDen, slipBps);
      }
    }
    if (amountOutMinimum === 0n) {
      throw new Error(
        "Single-hop minOut is 0 — enable Quoter (REBALANCE_USE_QUOTER=1) or fix RPC; mid fallback only covers WETH↔USDC.",
      );
    }

    const data = encodeFunctionData({
      abi: routerSingleAbi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: route.tokenIn,
          tokenOut: route.tokenOut,
          fee: route.fee,
          recipient: vault,
          amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    steps = [{ tokenIn: route.tokenIn, router: SWAP_ROUTER02, data }];
  } else {
    const pathBytes = encodeV3Path(route.pathTokens, route.fees);
    if (useQuoter && QUOTER) {
      try {
        const q = await publicClient.readContract({
          address: QUOTER,
          abi: quoterAbi,
          functionName: "quoteExactInput",
          args: [pathBytes, amountIn],
        });
        const quotedOut = Array.isArray(q) ? q[0] : q.amountOut;
        amountOutMinimum = (quotedOut * BigInt(10_000 - slipBps)) / 10_000n;
        minOutSource = "quoter_v2_path";
      } catch (e) {
        throw new Error(
          `Quoter quoteExactInput failed for multi-hop (set REBALANCE_USE_QUOTER=0 only if you accept unsafe minOut): ${e?.message ?? e}`,
        );
      }
    } else {
      throw new Error("Multi-hop rebalance requires Quoter (REBALANCE_USE_QUOTER=1) for a safe amountOutMinimum.");
    }

    const data = encodeFunctionData({
      abi: routerPathAbi,
      functionName: "exactInput",
      args: [
        {
          path: pathBytes,
          recipient: vault,
          amountIn,
          amountOutMinimum,
        },
      ],
    });
    steps = [{ tokenIn: route.tokenIn, router: SWAP_ROUTER02, data }];
  }

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
        explorer: explorerTxUrl(chainId, hash),
        vault,
        executor: account.address,
        chainYaml: fname,
        sell: { asset: sell.row.asset, symbol: sell.row.symbol, excess1e18: sell.excess.toString() },
        buy: { asset: buy.row.asset, symbol: buy.row.symbol, excess1e18: buy.excess.toString() },
        route,
        guards: {
          oraclePoolGuardChecked: applyOracleGuard,
          oraclePoolGuardDisabled: guardOff,
          oracleUsdcPerEth: oracleUsdcPerEth,
          poolMidUsdcPerEth: poolUsdcPerEth,
          deviationBps,
          maxDeviationBps: applyOracleGuard ? maxDevBps : null,
        },
        swap: {
          router: SWAP_ROUTER02,
          quoter: QUOTER ?? null,
          amountIn: amountIn.toString(),
          amountInHuman: humanAmount(route.tokenIn, amountIn, WETH, USDC, sell.decimals),
          amountOutMinimum: amountOutMinimum.toString(),
          slippageBps: slipBps,
          minOutSource,
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
