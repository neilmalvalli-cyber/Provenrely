// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ProvenrelyRegistry} from "./ProvenrelyRegistry.sol";

/// @notice Reusable guard: blocks calls that would benefit an address with an active flag in the registry.
abstract contract Unflagged {
    ProvenrelyRegistry public immutable registry;

    error RecipientFlagged(address to);
    error ZeroRegistry();

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroRegistry();
        registry = ProvenrelyRegistry(registry_);
    }

    /// @dev Reverts with RecipientFlagged(who) while the registry reports an active flag
    ///      (exists, not revoked, not expired) for `who`.
    modifier onlyUnflagged(address who) {
        // forge-lint: disable-next-line(unused-return) — only the contract's own `active` verdict is needed
        (, bool active) = registry.getFlag(who);
        if (active) revert RecipientFlagged(who);
        _;
    }
}
