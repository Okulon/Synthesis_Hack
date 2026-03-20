/**
 * Minimal RPC reads for allocation quorum (holders + AllocationBallotCast for one cycle).
 * Mirrors `frontend/src/lib/vault.ts` log semantics.
 */
import {
  createPublicClient,
  http,
  parseAbiItem,
  getAddress,
} from "viem";
import { base, baseSepolia } from "viem/chains";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
const allocationBallotEvent = parseAbiItem(
  "event AllocationBallotCast(address indexed voter, uint256 indexed cycleId, uint256[] weightsBps)",
);

/** Public RPCs cap `eth_getLogs` to a 10,000-block window per request. */
const ETH_GETLOGS_MAX_INCLUSIVE_SPAN = 10_000n;
const DEFAULT_HOLDER_LOOKBACK_BLOCKS = 100_000n;

async function getLogsChunked(client, q) {
  const out = [];
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

function pickChain(rpcUrl, chainId) {
  if (chainId === 8453) return { chain: base, transport: http(rpcUrl) };
  if (chainId === 84532) return { chain: baseSepolia, transport: http(rpcUrl) };
  return {
    chain: {
      id: chainId,
      name: "custom",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl),
  };
}

const daovaultAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
];

async function readHoldersFromLogs(client, vault, fromBlock, toBlock) {
  const logs = await getLogsChunked(client, {
    address: vault,
    event: transferEvent,
    fromBlock,
    toBlock,
  });

  const set = new Set();
  const zero = "0x0000000000000000000000000000000000000000";

  for (const log of logs) {
    const from = log.args?.from;
    const to = log.args?.to;
    if (from && String(from).toLowerCase() !== zero) set.add(getAddress(from));
    if (to && String(to).toLowerCase() !== zero) set.add(getAddress(to));
  }
  return [...set];
}

/**
 * Last ballot per voter for this on-chain cycleId (same semantics as frontend `readAllocationBallotsForCycle`).
 * @param {bigint} cycleId — vault `DAOVault.cycleId` (indexed in event)
 * @returns {{ voter: `0x${string}`; weightsBps: number[]; blockNumber: bigint; logIndex: number }[]}
 */
export async function readAllocationBallotsForCycleWithWeights(client, vault, fromBlock, toBlock, cycleId) {
  const logs = await getLogsChunked(client, {
    address: vault,
    event: allocationBallotEvent,
    args: { cycleId },
    fromBlock,
    toBlock,
  });

  const best = new Map();

  for (const log of logs) {
    const voter = log.args?.voter;
    const weightsBps = log.args?.weightsBps;
    if (!voter || !weightsBps) continue;
    const key = voter.toLowerCase();
    const blockNumber = log.blockNumber ?? 0n;
    const logIndex = log.logIndex ?? 0;
    const prev = best.get(key);
    if (
      !prev ||
      blockNumber > prev.blockNumber ||
      (blockNumber === prev.blockNumber && logIndex > prev.logIndex)
    ) {
      best.set(key, {
        voter: getAddress(voter),
        weightsBps: [...weightsBps].map((x) => Number(x)),
        blockNumber,
        logIndex,
      });
    }
  }

  return [...best.values()];
}

async function readAllocationBallotsForCycle(client, vault, fromBlock, toBlock, cycleId) {
  const rows = await readAllocationBallotsForCycleWithWeights(client, vault, fromBlock, toBlock, cycleId);
  return rows.map((b) => b.voter);
}

/**
 * @param {import("viem").PublicClient} client
 * @param {`0x${string}`} vault
 * @param {bigint} cycleId
 * @param {{ holderFromBlock?: bigint; allocationFromBlock?: bigint }} [opts]
 */
export async function fetchHoldersAndBallotVoters(client, vault, cycleId, opts = {}) {
  const blockNumber = await client.getBlockNumber();

  const holderFrom =
    opts.holderFromBlock !== undefined
      ? opts.holderFromBlock
      : blockNumber >= DEFAULT_HOLDER_LOOKBACK_BLOCKS
        ? blockNumber - DEFAULT_HOLDER_LOOKBACK_BLOCKS
        : 0n;

  const allocationFrom = opts.allocationFromBlock !== undefined ? opts.allocationFromBlock : holderFrom;

  const holderAddresses = await readHoldersFromLogs(client, vault, holderFrom, blockNumber);

  const holders = [];
  if (holderAddresses.length > 0) {
    const holderBalances = await client.multicall({
      contracts: holderAddresses.map((a) => ({
        address: vault,
        abi: daovaultAbi,
        functionName: "balanceOf",
        args: [a],
      })),
      allowFailure: false,
    });
    for (let i = 0; i < holderAddresses.length; i += 1) {
      const row = holderBalances[i];
      const bal = row.status === "success" ? /** @type {bigint} */ (row.result) : 0n;
      if (bal > 0n) holders.push({ address: holderAddresses[i], balance: bal });
    }
  }

  const ballotVoters = await readAllocationBallotsForCycle(
    client,
    vault,
    allocationFrom,
    blockNumber,
    cycleId,
  );

  return { holders, ballotVoters, blockNumber: blockNumber.toString() };
}

export function makeQuorumPublicClient(rpcUrl, chainId) {
  const { chain, transport } = pickChain(rpcUrl, chainId);
  return createPublicClient({ chain, transport });
}
