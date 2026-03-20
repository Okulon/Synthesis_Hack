import type { Address } from "viem";

/** Base Sepolia — align with `contracts/script/BaseSepolia.sol` */
export const SWAP_ROUTER02: Address = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4";

/** Uniswap v3 fee tier — WETH/USDC often 3000 (0.3%). Testnet pools may differ; TEST flow uses 0 minOut. */
export const UNISWAP_POOL_FEE_WETH_USDC = 3000;
