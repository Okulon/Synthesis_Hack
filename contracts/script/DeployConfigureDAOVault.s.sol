// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DAOVault} from "../src/DAOVault.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {BaseSepolia} from "./BaseSepolia.sol";

/// @notice One-shot: deploy `DAOVault` + mock oracles + allowlists + SwapRouter02 + executor (Base Sepolia).
contract DeployConfigureDAOVault is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        address deployer = vm.addr(pk);
        address guardianAddr = vm.envOr("GUARDIAN_ADDRESS", address(0));

        DAOVault v = new DAOVault(deployer, guardianAddr, "DAO Agent Vault Share", "dAGNT");

        // 8-decimal answers (Chainlink-style); vault scales to 1e18 NAV units
        MockAggregatorV3 aggUsdc = new MockAggregatorV3(8, int256(100_000_000)); // $1
        MockAggregatorV3 aggWeth = new MockAggregatorV3(8, int256(350_000_000_000)); // $3500

        DAOVault.AssetOracleConfig memory cfgUsdc = DAOVault.AssetOracleConfig({
            primaryAggregator: address(aggUsdc),
            secondaryAggregator: address(0),
            primaryHeartbeat: 86_400,
            secondaryHeartbeat: 0,
            minPrice1e18: 1e15,
            maxPrice1e18: 1e24,
            maxDeviationBps: 0
        });
        v.setAssetOracleConfig(BaseSepolia.USDC, cfgUsdc);

        DAOVault.AssetOracleConfig memory cfgWeth = DAOVault.AssetOracleConfig({
            primaryAggregator: address(aggWeth),
            secondaryAggregator: address(0),
            primaryHeartbeat: 86_400,
            secondaryHeartbeat: 0,
            minPrice1e18: 1e15,
            maxPrice1e18: 1e24,
            maxDeviationBps: 0
        });
        v.setAssetOracleConfig(BaseSepolia.WETH, cfgWeth);

        v.setAssetAllowed(BaseSepolia.USDC, true);
        v.setAssetAllowed(BaseSepolia.WETH, true);
        v.setRouterAllowed(BaseSepolia.SWAP_ROUTER02, true);

        address exec = vm.envOr("EXECUTOR_ADDRESS", deployer);
        v.setExecutor(exec);

        vm.stopBroadcast();

        console2.log("DAOVault:", address(v));
        console2.log("guardian (optional):", guardianAddr);
        console2.log("executor:", exec);
        console2.log("mock agg USDC:", address(aggUsdc));
        console2.log("mock agg WETH:", address(aggWeth));
        console2.log("USDC (allowlisted):", BaseSepolia.USDC);
        console2.log("WETH (allowlisted):", BaseSepolia.WETH);
        console2.log("SwapRouter02 (allowlisted):", BaseSepolia.SWAP_ROUTER02);
    }
}
