// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DAOVault} from "../src/DAOVault.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {BaseSepolia} from "./BaseSepolia.sol";

/// @notice Configure an **existing** vault (same mocks + allowlists as `DeployConfigureDAOVault`).
/// @dev Set `VAULT_ADDRESS` to a vault whose `GOVERNANCE_ROLE` is your broadcast key (e.g. fresh deploy).
contract ConfigureDAOVault is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address vaultAddr = vm.envAddress("VAULT_ADDRESS");
        address exec = vm.envOr("EXECUTOR_ADDRESS", deployer);

        vm.startBroadcast(pk);
        DAOVault v = DAOVault(vaultAddr);

        MockAggregatorV3 aggUsdc = new MockAggregatorV3(8, int256(100_000_000));
        MockAggregatorV3 aggWeth = new MockAggregatorV3(8, int256(350_000_000_000));

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
        v.setExecutor(exec);

        vm.stopBroadcast();

        console2.log("Configured vault:", vaultAddr);
        console2.log("mock agg USDC:", address(aggUsdc));
        console2.log("mock agg WETH:", address(aggWeth));
        console2.log("executor:", exec);
    }
}
