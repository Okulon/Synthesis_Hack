import { getAddress, isAddress } from "viem";

/** Trim + strip quotes (common `.env` copy-paste). */
export function normalizeEnvString(s: string | undefined): string {
  if (s == null || s === "") return "";
  let t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

/** Returns checksummed address or `undefined` if missing / invalid. */
export function parseVaultAddress(v: string | undefined): `0x${string}` | undefined {
  const raw = normalizeEnvString(v);
  if (!raw) return undefined;
  if (!isAddress(raw)) return undefined;
  return getAddress(raw);
}
