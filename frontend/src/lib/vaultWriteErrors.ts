import {
  type Abi,
  type Hex,
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  RawContractError,
  decodeErrorResult,
} from "viem";

/** First 4 bytes when ABI decode isn’t available (cast sig "<Error>()"). */
const KNOWN_SELECTORS: Record<string, string> = {
  "0x9e87fac8": "Paused",
  "0x54b8210d": "MinShares",
  "0xe6cef46f": "BadBallot",
  "0x3ee5aeb5": "ReentrancyGuardReentrantCall",
};

function mapErrorName(n: string): string | null {
  if (n === "Paused") return "Paused — vault pauseAll is active.";
  if (n === "MinShares") return "MinShares — caller has no vault shares (deposit with this wallet as receiver).";
  if (n === "BadBallot")
    return "BadBallot — weights must match every tracked asset and sum to exactly 10_000 bps.";
  if (n === "ReentrancyGuardReentrantCall") return "ReentrancyGuardReentrantCall — re-entrancy (unexpected).";
  return null;
}

function normalizeHex(data: unknown): Hex | undefined {
  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) return data as Hex;
  if (data && typeof data === "object" && "data" in data) {
    const inner = (data as { data?: unknown }).data;
    return normalizeHex(inner);
  }
  return undefined;
}

/** Walk viem / JSON-RPC error shapes to find revert data. */
function collectRevertHex(err: unknown): Hex | undefined {
  const seen = new Set<unknown>();
  const visit = (e: unknown): Hex | undefined => {
    if (e === null || e === undefined || typeof e !== "object") return undefined;
    if (seen.has(e)) return undefined;
    seen.add(e);

    if (e instanceof RawContractError) {
      const h = normalizeHex(e.data);
      if (h) return h;
    }
    if (e instanceof ContractFunctionRevertedError) {
      if (e.raw) return e.raw as Hex;
      const h = normalizeHex(e);
      if (h) return h;
    }
    if (e instanceof ContractFunctionExecutionError) {
      const h = visit(e.cause);
      if (h) return h;
    }
    if (e instanceof BaseError) {
      const h = visit(e.cause);
      if (h) return h;
      const w = e.walk((x) => x instanceof RawContractError || x instanceof ContractFunctionRevertedError);
      if (w instanceof RawContractError) {
        const h2 = normalizeHex(w.data);
        if (h2) return h2;
      }
      if (w instanceof ContractFunctionRevertedError && w.raw) return w.raw as Hex;
    }

    const rec = e as Record<string, unknown>;
    if ("data" in rec) {
      const h = normalizeHex(rec.data);
      if (h) return h;
    }
    if ("cause" in rec && rec.cause) return visit(rec.cause);
    return undefined;
  };
  return visit(err);
}

/** Turn viem / wallet errors into a short revert reason when possible. */
export function formatContractRevert(abi: Abi, err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((x) => x instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const decoded = reverted.data as { errorName?: string } | undefined;
      if (decoded?.errorName) {
        const friendly = mapErrorName(decoded.errorName);
        if (friendly) return friendly;
        return `${decoded.errorName}()`;
      }
      if (reverted.raw) {
        try {
          const d = decodeErrorResult({ abi, data: reverted.raw as Hex });
          const friendly = mapErrorName(d.errorName);
          if (friendly) return friendly;
          return `${d.errorName}()`;
        } catch {
          /* skip */
        }
      }
      if (reverted.reason && reverted.reason !== "execution reverted") return reverted.reason;
    }
  }

  const hex = collectRevertHex(err);
  if (hex && hex.length >= 10) {
    const prefix = (hex.slice(0, 10) as string).toLowerCase();
    const known = KNOWN_SELECTORS[prefix];
    if (known) {
      const friendly = mapErrorName(known);
      if (friendly) return friendly;
      return `${known}()`;
    }
    try {
      const d = decodeErrorResult({ abi, data: hex });
      const friendly = mapErrorName(d.errorName);
      if (friendly) return friendly;
      return `${d.errorName}()`;
    } catch {
      /* fall through */
    }
    if (hex === "0x") {
      return "Empty revert — often wrong proxy/implementation (no castAllocationBallot), or contract self-destructed.";
    }
    return `Revert data: ${hex.slice(0, 18)}…`;
  }

  const msg = err instanceof Error ? err.message : String(err);
  if (msg.toLowerCase().includes("execution reverted")) {
    return `${msg} (If no reason: redeploy DAOVault with castAllocationBallot, or check proxy implementation.)`;
  }
  return msg;
}
