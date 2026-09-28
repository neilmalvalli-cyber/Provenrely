// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ProvenrelyRegistry} from "../src/ProvenrelyRegistry.sol";
import {SafeSend} from "../src/SafeSend.sol";
import {Unflagged} from "../src/Unflagged.sol";

contract RejectsEther {
    receive() external payable {
        revert("no thanks");
    }
}

contract SafeSendTest is Test {
    event Sent(address indexed from, address indexed to, uint256 amount);

    ProvenrelyRegistry registry;
    SafeSend safeSend;

    address issuer = makeAddr("issuer");
    address sender = makeAddr("sender");
    address payable recipient = payable(makeAddr("recipient"));

    function setUp() public {
        registry = new ProvenrelyRegistry(address(this));
        registry.addIssuer(issuer);
        safeSend = new SafeSend(address(registry));
        vm.deal(sender, 100 ether);
    }

    function _flag(address who, uint64 expiry) internal {
        vm.prank(issuer);
        registry.flag(who, 1, bytes32("evidence"), expiry);
    }

    function test_SendToUnflagged() public {
        vm.expectEmit(true, true, false, true, address(safeSend));
        emit Sent(sender, recipient, 1 ether);

        vm.prank(sender);
        safeSend.send{value: 1 ether}(recipient);

        assertEq(recipient.balance, 1 ether);
        assertEq(sender.balance, 99 ether);
        assertEq(address(safeSend).balance, 0);
    }

    function test_RevertWhen_RecipientFlagged() public {
        _flag(recipient, 0);

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(Unflagged.RecipientFlagged.selector, recipient));
        safeSend.send{value: 1 ether}(recipient);

        assertEq(recipient.balance, 0);
        assertEq(sender.balance, 100 ether);
    }

    function test_SendAfterRevoke() public {
        _flag(recipient, 0);
        vm.prank(issuer);
        registry.revoke(recipient);

        vm.prank(sender);
        safeSend.send{value: 1 ether}(recipient);
        assertEq(recipient.balance, 1 ether);
    }

    function test_SendAfterExpiry() public {
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 expiry = uint64(block.timestamp + 100);
        _flag(recipient, expiry);

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(Unflagged.RecipientFlagged.selector, recipient));
        safeSend.send{value: 1 ether}(recipient);

        vm.warp(expiry + 1);
        vm.prank(sender);
        safeSend.send{value: 1 ether}(recipient);
        assertEq(recipient.balance, 1 ether);
    }

    function testFuzz_SendAmount(uint256 amount) public {
        amount = bound(amount, 0, 100 ether);

        vm.prank(sender);
        safeSend.send{value: amount}(recipient);

        assertEq(recipient.balance, amount);
        assertEq(sender.balance, 100 ether - amount);
        assertEq(address(safeSend).balance, 0);
    }

    function test_RevertWhen_RecipientRejectsEther() public {
        address payable rejecter = payable(address(new RejectsEther()));

        vm.prank(sender);
        vm.expectRevert(SafeSend.TransferFailed.selector);
        safeSend.send{value: 1 ether}(rejecter);
    }

    function test_RevertWhen_ZeroRecipient() public {
        vm.prank(sender);
        vm.expectRevert(SafeSend.ZeroRecipient.selector);
        safeSend.send{value: 1 ether}(payable(address(0)));
    }

    function test_RevertWhen_ZeroRegistry() public {
        vm.expectRevert(Unflagged.ZeroRegistry.selector);
        new SafeSend(address(0));
    }
}
