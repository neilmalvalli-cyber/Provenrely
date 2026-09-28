// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ProvenrelyRegistry} from "../src/ProvenrelyRegistry.sol";

contract ProvenrelyRegistryTest is Test {
    ProvenrelyRegistry public registry;

    address public admin = address(0x1);
    address public issuer = address(0x2);
    address public user1 = address(0x3);
    address public relayer = address(0x4);

    function setUp() public {
        // Deploy contract as admin
        vm.prank(admin);
        registry = new ProvenrelyRegistry(admin);

        // Grant roles using admin prank
        vm.startPrank(admin);
        registry.addIssuer(issuer);
        registry.grantRole(registry.RELAYER(), relayer);
        vm.stopPrank();
    }

    function test_FlagAddress() public {
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 expiry = uint64(block.timestamp + 100);

        vm.prank(issuer);
        registry.flag(user1, 1, bytes32("evidence"), expiry);

        assertTrue(registry.isFlagged(user1));
    }

    function test_RevokeFlag() public {
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 expiry = uint64(block.timestamp + 100);

        vm.prank(issuer);
        registry.flag(user1, 1, bytes32("evidence"), expiry);

        vm.prank(issuer);
        registry.revoke(user1);

        assertFalse(registry.isFlagged(user1));
    }

    function test_AnchorCertificate() public {
        bytes32 certHash = keccak256("cert123");

        vm.prank(relayer);
        registry.anchorCertificate(certHash, user1);

        (address subject, uint64 ts) = registry.certificates(certHash);
        assertEq(subject, user1);
        assertGt(ts, 0);
    }
}
