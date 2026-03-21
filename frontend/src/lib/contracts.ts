import type { Address } from "viem";

/** Base Sepolia — align with `contracts/script/BaseSepolia.sol` */
export const SWAP_ROUTER02: Address = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4";

/** Uniswap V3 QuoterV2 — `config/chain/base_sepolia.yaml` */
export const QUOTER_V2: Address = "0xC5290058841028F1614F3A6F0F5816cAd0df5E27";

/** Uniswap v3 fee tier — WETH/USDC often 3000 (0.3%). Testnet pools may differ. */
export const UNISWAP_POOL_FEE_WETH_USDC = 3000;

/** Quoter-based router `minOut` (single-asset redeem, TEST WETH→USDC swap). */
export const DEFAULT_SWAP_SLIPPAGE_BPS = 100;

/** @alias {@link DEFAULT_SWAP_SLIPPAGE_BPS} */
export const DEFAULT_REDEEM_SLIPPAGE_BPS = DEFAULT_SWAP_SLIPPAGE_BPS;
