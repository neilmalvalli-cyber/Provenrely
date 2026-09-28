// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProvenrelyRegistry} from "../src/ProvenrelyRegistry.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(deployerKey);
        address issuer = vm.envAddress("ISSUER_ADDR");
        address relayer = vm.envAddress("RELAYER_ADDR");

        vm.startBroadcast(deployerKey);
        ProvenrelyRegistry reg = new ProvenrelyRegistry(deployer);
        reg.addIssuer(issuer);
        reg.grantRole(reg.RELAYER(), relayer);
        vm.stopBroadcast();

        console.log("REGISTRY DEPLOYED AT:", address(reg));
    }
}
