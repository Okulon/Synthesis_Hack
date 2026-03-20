import type { Address } from "viem";

/** Base Sepolia — same as `config/chain/base_sepolia.yaml` / `BaseSepolia.sol` */
export const TOKENS = {
  USDC: {
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
    symbol: "USDC",
    decimals: 6,
  },
  WETH: {
    address: "0x4200000000000000000000000000000000000006" as Address,
    symbol: "WETH",
    decimals: 18,
  },
} as const;

export type TokenKey = keyof typeof TOKENS | "ETH";

/** Vault always receives WETH/USDC ERC-20; `ETH` is UI-only (wrap → WETH → deposit). */
export function isEthMode(k: TokenKey): k is "ETH" {
  return k === "ETH";
}
