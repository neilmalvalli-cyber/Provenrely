// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Unflagged} from "./Unflagged.sol";

/// @notice Forwards native tokens to a recipient, reverting on-chain if the recipient is flagged.
contract SafeSend is Unflagged {
    event Sent(address indexed from, address indexed to, uint256 amount);

    error ZeroRecipient();
    error TransferFailed();

    constructor(address registry_) Unflagged(registry_) {}

    function send(address payable to) external payable onlyUnflagged(to) {
        if (to == address(0)) revert ZeroRecipient();
        emit Sent(msg.sender, to, msg.value); // before the call; a failed transfer reverts it anyway
        // forge-lint: disable-next-line(arbitrary-send-eth) — forwarding to the caller's chosen recipient is the point
        (bool ok,) = to.call{value: msg.value}("");
        if (!ok) revert TransferFailed();
    }
}
