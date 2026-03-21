/**
 * Governance: DAOVault.closeCycle(navStart, navEnd) — advances on-chain cycleId (new allocation period).
 * Used by `npm run agent` when wall-clock window rolls so the UI "Voted" state resets for the new period.
 *
 * Env: CHAIN_RPC_URL, VAULT_ADDRESS, GOVERNANCE_PRIVATE_KEY, optional CHAIN_ID (84532 default)
 * Optional: CLOSE_CYCLE_WALL_KEY — wall-clock window index that just ended (agent sets on rollover).
 *   Used with vote-store + trust CSV to compute off-chain profit splits in frontend/public/cycle-profits.json.
 *
 * NAV bookkeeping: `config/local/agent-close-cycle-state.json` stores last navEnd as navStart for the next close.
 */
import fs from "fs";
import path from "path";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

import { repoRoot, requireEnv } from "./lib/env.mjs";
import { writeCycleProfitsArtifact } from "./lib/profitExportCore.mjs";

const vaultAbi = parseAbi([
  "function closeCycle(uint256 navStart, uint256 navEnd)",
  "function totalNAV() view returns (uint256)",
  "function cycleId() view returns (uint256)",
  "function GOVERNANCE_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
]);

function closeLogPath() {
  return path.join(repoRoot, "config/local/cycle-close-log.json");
}

function appendCloseLogEntry(entry) {
  const p = closeLogPath();
  let log = { version: 1, entries: [] };
  if (fs.existsSync(p)) {
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      log = { version: 1, entries: Array.isArray(j.entries) ? j.entries : [] };
    } catch {
      log = { version: 1, entries: [] };
    }
  }
  log.entries.push(entry);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(log, null, 2));
}

function parsePk(raw) {
  const s = raw.trim();
  return s.startsWith("0x") ? s : `0x${s}`;
}

function agentNavStatePath() {
  return path.join(repoRoot, "config/local/agent-close-cycle-state.json");
}

function loadNavState() {
  const p = agentNavStatePath();
  if (!fs.existsSync(p)) return { lastNavEnd1e18: null };
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { lastNavEnd1e18: null };
  }
}

function saveNavState(obj) {
  const dest = agentNavStatePath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(obj, null, 2));
}

function getChain(chainId) {
  if (chainId === 8453) return base;
  if (chainId === 84532) return baseSepolia;
  throw new Error(`close-cycle: unsupported CHAIN_ID ${chainId} (use 84532 or 8453)`);
}

async function main() {
  const rpcUrl = requireEnv("CHAIN_RPC_URL");
  const vault = requireEnv("VAULT_ADDRESS");
  const pk = parsePk(requireEnv("GOVERNANCE_PRIVATE_KEY"));
  const chainId = Number(process.env.CHAIN_ID ?? "84532");
  const chain = getChain(chainId);

  const account = privateKeyToAccount(pk);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const govRole = await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "GOVERNANCE_ROLE",
  });

  const hasGov = await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "hasRole",
    args: [govRole, account.address],
  });

  if (!hasGov) {
    throw new Error(
      `GOVERNANCE_PRIVATE_KEY → ${account.address} does not have GOVERNANCE_ROLE on vault — cannot closeCycle`,
    );
  }

  const navEnd = await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "totalNAV",
  });

  const cycleIdBefore = await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "cycleId",
  });

  const st = loadNavState();
  const navStart =
    st.lastNavEnd1e18 != null && st.lastNavEnd1e18 !== "" ? BigInt(st.lastNavEnd1e18) : navEnd;

  const wallRaw = process.env.CLOSE_CYCLE_WALL_KEY;
  const wallClockIndex =
    wallRaw !== undefined && wallRaw !== "" && !Number.isNaN(Number(wallRaw)) ? Number(wallRaw) : null;

  const hash = await walletClient.writeContract({
    address: vault,
    abi: vaultAbi,
    functionName: "closeCycle",
    args: [navStart, navEnd],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`closeCycle tx reverted on-chain (status=${receipt.status}) hash=${hash}`);
  }

  const cycleIdAfter = await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "cycleId",
  });

  saveNavState({
    lastNavEnd1e18: navEnd.toString(),
    lastCloseAt: new Date().toISOString(),
    lastTxHash: hash,
  });

  const closedAt = new Date().toISOString();
  appendCloseLogEntry({
    wallClockIndex,
    onChainCycleIdBeforeClose: Number(cycleIdBefore),
    onChainCycleIdAfterClose: Number(cycleIdAfter),
    navStart1e18: navStart.toString(),
    navEnd1e18: navEnd.toString(),
    navDelta1e18: (navEnd - navStart).toString(),
    closedAt,
    txHash: hash,
  });

  try {
    writeCycleProfitsArtifact();
  } catch (e) {
    console.warn("[close-cycle] profit export:", e?.message ?? e);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        txHash: hash,
        status: receipt.status,
        navStart: navStart.toString(),
        navEnd: navEnd.toString(),
        wallClockIndex,
        onChainCycleIdAfterClose: cycleIdAfter.toString(),
        signer: account.address,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
