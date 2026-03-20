import {
  type Address,
  type Hex,
  type PublicClient,
  formatUnits,
  getAddress,
  isAddress,
  parseAbiItem,
} from "viem";
import { daovaultAbi, erc20Abi } from "./abi";
import { normalizeEnvString } from "./env";
import { DEFAULT_ADMIN_ROLE, GOVERNANCE_ROLE, GUARDIAN_ROLE } from "./roles";

const roleGrantedEvent = parseAbiItem(
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)"
);
const roleRevokedEvent = parseAbiItem(
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)"
);
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/** Public RPCs (e.g. `https://sepolia.base.org`) cap `eth_getLogs` to a 10,000-block window per request. */
const ETH_GETLOGS_MAX_INCLUSIVE_SPAN = 10_000n;

/**
 * When `VITE_ROLE_LOGS_FROM_BLOCK` is unset, only scan this many blocks back for `RoleGranted` / `RoleRevoked`
 * (avoids thousands of chunked requests from genesis).
 */
export const DEFAULT_ROLE_LOOKBACK_BLOCKS = 100_000n;

type VaultLogEvent = typeof roleGrantedEvent | typeof roleRevokedEvent | typeof transferEvent;

async function getLogsChunked(
  client: PublicClient,
  q: {
    address: Address;
    event: VaultLogEvent;
    args?: { role?: Hex };
    fromBlock: bigint;
    toBlock: bigint;
  }
) {
  const out: Awaited<ReturnType<PublicClient["getLogs"]>> = [];
  let from = q.fromBlock;
  while (from <= q.toBlock) {
    const span = ETH_GETLOGS_MAX_INCLUSIVE_SPAN - 1n;
    const to = from + span > q.toBlock ? q.toBlock : from + span;
    const batch = await client.getLogs({
      address: q.address,
      event: q.event,
      args: q.args,
      fromBlock: from,
      toBlock: to,
    });
    out.push(...batch);
    from = to + 1n;
  }
  return out;
}

export type OracleConfigRow = {
  primaryAggregator: Address;
  secondaryAggregator: Address;
  primaryHeartbeat: number;
  secondaryHeartbeat: number;
  minPrice1e18: bigint;
  maxPrice1e18: bigint;
  maxDeviationBps: number;
};

export type AssetRow = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  balanceRaw: bigint;
  price1e18: bigint;
  valueNav1e18: bigint;
  isAllowed: boolean;
  oracle: OracleConfigRow;
  manualPrice1e18: bigint;
  manualExpiresAt: bigint;
  legacyNav1e18: bigint;
};

export type RoleSlice = {
  label: string;
  role: `0x${string}`;
  members: Address[];
};

export type HolderRow = {
  address: Address;
  balance: bigint;
};

export type VaultSnapshot = {
  chainId: number;
  blockNumber: bigint;
  /** `RoleGranted` / `RoleRevoked` were scanned in `[from, to]` (RPC `eth_getLogs` limits + lookback default). */
  roleLogScan: { fromBlock: bigint; toBlock: bigint };
  /** Share-holder `Transfer` logs were scanned in `[from, to]`. */
  holderLogScan: { fromBlock: bigint; toBlock: bigint };
  vault: Address;
  vaultName: string;
  vaultSymbol: string;
  totalSupply: bigint;
  totalNAV1e18: bigint;
  cycleId: bigint;
  executor: Address;
  pauseAll: boolean;
  pauseTrading: boolean;
  pauseDeposits: boolean;
  assets: AssetRow[];
  roles: RoleSlice[];
  holders: HolderRow[];
};

const KNOWN: Record<string, string> = {
  "0x4200000000000000000000000000000000000006": "WETH (Base)",
  "0x036cbd53842c5426634e7929541ec2318f3dcf7e": "USDC (Base Sepolia)",
};

function labelAddr(a: Address): string {
  return KNOWN[a.toLowerCase()] ?? "";
}

function mulDivFloor(value: bigint, mul: bigint, div: bigint): bigint {
  return (value * mul) / div;
}

/** viem `multicall` items are `{ status, result }` — normalize for TS + runtime. */
function mc<T>(row: { status: "success"; result: T } | { result: T } | T): T {
  if (row !== null && typeof row === "object" && "result" in row) {
    return (row as { result: T }).result;
  }
  return row as T;
}

function parseOracleFromMulticall(r: unknown): OracleConfigRow {
  if (Array.isArray(r)) {
    const [a, b, ph, sh, minP, maxP, dev] = r as [
      Address,
      Address,
      number | bigint,
      number | bigint,
      bigint,
      bigint,
      number | bigint,
    ];
    return {
      primaryAggregator: getAddress(a),
      secondaryAggregator: getAddress(b),
      primaryHeartbeat: Number(ph),
      secondaryHeartbeat: Number(sh),
      minPrice1e18: minP,
      maxPrice1e18: maxP,
      maxDeviationBps: Number(dev),
    };
  }
  const o = r as {
    primaryAggregator: Address;
    secondaryAggregator: Address;
    primaryHeartbeat: bigint | number;
    secondaryHeartbeat: bigint | number;
    minPrice1e18: bigint;
    maxPrice1e18: bigint;
    maxDeviationBps: bigint | number;
  };
  return {
    primaryAggregator: getAddress(o.primaryAggregator),
    secondaryAggregator: getAddress(o.secondaryAggregator),
    primaryHeartbeat: Number(o.primaryHeartbeat),
    secondaryHeartbeat: Number(o.secondaryHeartbeat),
    minPrice1e18: o.minPrice1e18,
    maxPrice1e18: o.maxPrice1e18,
    maxDeviationBps: Number(o.maxDeviationBps),
  };
}

function parseManualFromMulticall(r: unknown): { price1e18: bigint; expiresAt: bigint } {
  if (Array.isArray(r)) {
    return {
      price1e18: r[0] as bigint,
      expiresAt: BigInt(r[1] as bigint | number),
    };
  }
  const m = r as { price1e18: bigint; expiresAt: bigint | number };
  return { price1e18: m.price1e18, expiresAt: BigInt(m.expiresAt) };
}

/** DAOVault uses OZ `AccessControl` (not Enumerable) — derive members from `RoleGranted` / `RoleRevoked`. */
async function readRoleMembersFromLogs(
  client: PublicClient,
  vault: Address,
  role: Hex,
  label: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<RoleSlice> {
  const [granted, revoked] = await Promise.all([
    getLogsChunked(client, {
      address: vault,
      event: roleGrantedEvent,
      args: { role },
      fromBlock,
      toBlock,
    }),
    getLogsChunked(client, {
      address: vault,
      event: roleRevokedEvent,
      args: { role },
      fromBlock,
      toBlock,
    }),
  ]);

  type Ev = { blockNumber: bigint; logIndex: number; add: boolean; account: Address };
  const evs: Ev[] = [];
  type RoleLog = { blockNumber: bigint | null; logIndex: number | null; args?: { account?: Address } };
  for (const log of granted as RoleLog[]) {
    const acc = log.args?.account;
    if (acc === undefined) continue;
    evs.push({
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      add: true,
      account: getAddress(acc),
    });
  }
  for (const log of revoked as RoleLog[]) {
    const acc = log.args?.account;
    if (acc === undefined) continue;
    evs.push({
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      add: false,
      account: getAddress(acc),
    });
  }
  evs.sort((a, b) => {
    if (a.blockNumber === b.blockNumber) return a.logIndex - b.logIndex;
    return a.blockNumber < b.blockNumber ? -1 : 1;
  });

  const set = new Set<string>();
  for (const e of evs) {
    const k = e.account;
    if (e.add) set.add(k);
    else set.delete(k);
  }

  return { label, role, members: [...set].map((a) => getAddress(a as Address)) };
}

async function readHoldersFromLogs(
  client: PublicClient,
  vault: Address,
  fromBlock: bigint,
  toBlock: bigint
): Promise<Address[]> {
  const logs = await getLogsChunked(client, {
    address: vault,
    event: transferEvent,
    fromBlock,
    toBlock,
  });

  type TransferLog = {
    args?: { from?: Address; to?: Address };
  };
  const set = new Set<string>();
  const zero = "0x0000000000000000000000000000000000000000";

  for (const log of logs as TransferLog[]) {
    const from = log.args?.from;
    const to = log.args?.to;
    if (from && from.toLowerCase() !== zero) set.add(getAddress(from));
    if (to && to.toLowerCase() !== zero) set.add(getAddress(to));
  }
  return [...set].map((a) => getAddress(a as Address));
}

export async function fetchVaultSnapshot(
  client: PublicClient,
  vaultAddress: string,
  options?: { roleLogsFromBlock?: bigint; holderLogsFromBlock?: bigint }
): Promise<VaultSnapshot> {
  const cleaned = normalizeEnvString(vaultAddress);
  if (!cleaned) {
    throw new Error(
      "VITE_VAULT_ADDRESS is empty. In frontend/.env.local set VITE_VAULT_ADDRESS=0x… — Vite only exposes vars prefixed with VITE_ (repo root VAULT_ADDRESS is not read here)."
    );
  }
  if (!isAddress(cleaned)) {
    throw new Error(
      `Invalid vault address after trim/quotes: "${cleaned.length > 24 ? `${cleaned.slice(0, 24)}…` : cleaned}"`
    );
  }
  const vault = getAddress(cleaned);
  const chainId = await client.getChainId();
  const blockNumber = await client.getBlockNumber();

  const base = await client.multicall({
    contracts: [
      { address: vault, abi: daovaultAbi, functionName: "name" },
      { address: vault, abi: daovaultAbi, functionName: "symbol" },
      { address: vault, abi: daovaultAbi, functionName: "totalSupply" },
      { address: vault, abi: daovaultAbi, functionName: "totalNAV" },
      { address: vault, abi: daovaultAbi, functionName: "cycleId" },
      { address: vault, abi: daovaultAbi, functionName: "executor" },
      { address: vault, abi: daovaultAbi, functionName: "pauseAll" },
      { address: vault, abi: daovaultAbi, functionName: "pauseTrading" },
      { address: vault, abi: daovaultAbi, functionName: "pauseDeposits" },
      { address: vault, abi: daovaultAbi, functionName: "trackedAssetsLength" },
    ],
    allowFailure: false,
  });

  const vaultName = mc(base[0]) as string;
  const vaultSymbol = mc(base[1]) as string;
  const totalSupply = mc(base[2]) as bigint;
  const totalNAV1e18 = mc(base[3]) as bigint;
  const cycleId = mc(base[4]) as bigint;
  const executor = getAddress(mc(base[5]) as Address);
  const pauseAll = mc(base[6]) as boolean;
  const pauseTrading = mc(base[7]) as boolean;
  const pauseDeposits = mc(base[8]) as boolean;
  const trackedLen = mc(base[9]) as bigint;

  const tracked: Address[] = [];
  if (trackedLen > 0n) {
    const trackedCalls = Array.from({ length: Number(trackedLen) }, (_, i) => ({
      address: vault,
      abi: daovaultAbi,
      functionName: "trackedAssets" as const,
      args: [BigInt(i)] as const,
    }));
    const tr = await client.multicall({ contracts: trackedCalls, allowFailure: false });
    for (const row of tr) {
      tracked.push(getAddress(mc(row) as Address));
    }
  }

  const assetRows: AssetRow[] = [];
  for (const asset of tracked) {
    const chunk = await client.multicall({
      contracts: [
        {
          address: asset,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [vault],
        },
        { address: asset, abi: erc20Abi, functionName: "symbol" },
        { address: asset, abi: erc20Abi, functionName: "decimals" },
        { address: asset, abi: erc20Abi, functionName: "name" },
        { address: vault, abi: daovaultAbi, functionName: "pricePerFullToken1e18", args: [asset] },
        { address: vault, abi: daovaultAbi, functionName: "isAssetAllowed", args: [asset] },
        { address: vault, abi: daovaultAbi, functionName: "assetOracleConfig", args: [asset] },
        { address: vault, abi: daovaultAbi, functionName: "manualPrice", args: [asset] },
        { address: vault, abi: daovaultAbi, functionName: "navPricePerFullToken1e18", args: [asset] },
      ],
      allowFailure: false,
    });

    const balanceRaw = mc(chunk[0]) as bigint;
    const symbol = mc(chunk[1]) as string;
    const decimals = Number(mc(chunk[2]) as number);
    const name = mc(chunk[3]) as string;
    const price1e18 = mc(chunk[4]) as bigint;
    const isAllowed = mc(chunk[5]) as boolean;
    const oracle = parseOracleFromMulticall(mc(chunk[6]));
    const manual = parseManualFromMulticall(mc(chunk[7]));
    const legacyNav1e18 = mc(chunk[8]) as bigint;

    const valueNav1e18 =
      balanceRaw === 0n || price1e18 === 0n
        ? 0n
        : mulDivFloor(balanceRaw, price1e18, 10n ** BigInt(decimals));

    assetRows.push({
      address: asset,
      name: labelAddr(asset) || name,
      symbol,
      decimals,
      balanceRaw,
      price1e18,
      valueNav1e18,
      isAllowed,
      oracle,
      manualPrice1e18: manual.price1e18,
      manualExpiresAt: manual.expiresAt,
      legacyNav1e18,
    });
  }

  /** `undefined` → last {@link DEFAULT_ROLE_LOOKBACK_BLOCKS} blocks (public RPC-safe). `0n` → genesis (chunked). */
  const roleFrom =
    options?.roleLogsFromBlock !== undefined
      ? options.roleLogsFromBlock
      : blockNumber >= DEFAULT_ROLE_LOOKBACK_BLOCKS
        ? blockNumber - DEFAULT_ROLE_LOOKBACK_BLOCKS
        : 0n;

  const [gov, guardian, admin] = await Promise.all([
    readRoleMembersFromLogs(client, vault, GOVERNANCE_ROLE, "Governance", roleFrom, blockNumber),
    readRoleMembersFromLogs(client, vault, GUARDIAN_ROLE, "Guardian", roleFrom, blockNumber),
    readRoleMembersFromLogs(client, vault, DEFAULT_ADMIN_ROLE, "Admin (default)", roleFrom, blockNumber),
  ]);

  const holderFrom =
    options?.holderLogsFromBlock !== undefined
      ? options.holderLogsFromBlock
      : blockNumber >= DEFAULT_ROLE_LOOKBACK_BLOCKS
        ? blockNumber - DEFAULT_ROLE_LOOKBACK_BLOCKS
        : 0n;
  const holderAddresses = await readHoldersFromLogs(client, vault, holderFrom, blockNumber);

  const holders: HolderRow[] = [];
  if (holderAddresses.length > 0) {
    const holderCalls = holderAddresses.map((a) => ({
      address: vault,
      abi: daovaultAbi,
      functionName: "balanceOf" as const,
      args: [a] as const,
    }));
    const holderBalances = await client.multicall({ contracts: holderCalls, allowFailure: false });
    for (let i = 0; i < holderAddresses.length; i += 1) {
      const bal = mc(holderBalances[i]) as bigint;
      if (bal > 0n) holders.push({ address: holderAddresses[i], balance: bal });
    }
    holders.sort((a, b) => (a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1));
  }

  return {
    chainId,
    blockNumber,
    roleLogScan: { fromBlock: roleFrom, toBlock: blockNumber },
    holderLogScan: { fromBlock: holderFrom, toBlock: blockNumber },
    vault,
    vaultName,
    vaultSymbol,
    totalSupply,
    totalNAV1e18,
    cycleId,
    executor,
    pauseAll,
    pauseTrading,
    pauseDeposits,
    assets: assetRows,
    roles: [admin, gov, guardian],
    holders,
  };
}

/** NAV in 1e18 units — avoid fixed 2dp (tiny deposits like 0.001 USDC would show as `0.00`). */
export function formatNav1e18(n: bigint, fractionDigits = 2): string {
  const s = formatUnits(n, 18);
  const x = Number(s);
  if (!Number.isFinite(x)) return s;
  if (x === 0) return "0";
  const ax = Math.abs(x);
  if (ax < 1) {
    return x.toLocaleString(undefined, {
      maximumFractionDigits: 8,
      minimumFractionDigits: 0,
    });
  }
  return x.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Share of total NAV for one asset (same units as `valueNav1e18` / `totalNAV1e18`). */
export function formatAssetWeightPct(valueNav1e18: bigint, totalNAV1e18: bigint): string {
  if (totalNAV1e18 === 0n) return "—";
  // two decimal places: value/total * 100 == (value * 10000) / total / 100
  const p100 = (valueNav1e18 * 10_000n) / totalNAV1e18;
  const intPart = p100 / 100n;
  const frac = p100 % 100n;
  return `${intPart}.${frac.toString().padStart(2, "0")}%`;
}

export function shortAddr(a: string, n = 4): string {
  if (!a.startsWith("0x") || a.length < 10) return a;
  return `${a.slice(0, 2 + n)}…${a.slice(-n)}`;
}
