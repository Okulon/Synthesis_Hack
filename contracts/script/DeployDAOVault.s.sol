// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DAOVault} from "../src/DAOVault.sol";

contract DeployDAOVault is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        address deployer = vm.addr(pk);
        address guardianAddr = vm.envOr("GUARDIAN_ADDRESS", address(0));
        DAOVault v = new DAOVault(deployer, guardianAddr, "DAO Agent Vault Share", "dAGNT");
        vm.stopBroadcast();
        console2.log("DAOVault:", address(v));
        console2.log("guardian (emergency pause only, optional):", guardianAddr);
    }
}
