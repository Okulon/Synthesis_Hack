// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Base Sepolia — canonical addresses (Uniswap docs; verify on Basescan)
/// @notice https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments
library BaseSepolia {
    address internal constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant UNISWAP_V3_FACTORY = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address internal constant SWAP_ROUTER02 = 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4;
    address internal constant QUOTER_V2 = 0xC5290058841028F1614F3A6F0F5816cAd0df5E27;
}
