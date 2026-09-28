// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract ProvenrelyRegistry is AccessControl {
    bytes32 public constant ISSUER = keccak256("ISSUER");
    bytes32 public constant RELAYER = keccak256("RELAYER");

    struct Flag {
        address issuer;
        uint16 reason;
        bytes32 evidenceHash;
        uint64 expiry;
        bool revoked;
    }

    struct Anchor {
        address subject;
        uint64 timestamp;
    }

    mapping(address => Flag) private _flags;
    mapping(bytes32 => Anchor) public certificates;

    event Flagged(address indexed subject, address indexed issuer, uint16 reason, bytes32 evidenceHash, uint64 expiry);
    event Revoked(address indexed subject, address indexed by);
    event CertificateAnchored(bytes32 indexed certHash, address indexed subject, uint64 timestamp);
    event CustodyLogged(bytes32 indexed certHash, address indexed actor, uint8 action, uint64 ts);

    error AlreadyFlagged(address subject);
    error NotFlagged(address subject);
    error NotAllowed();
    error BadExpiry();
    error ZeroValue();
    error AlreadyAnchored(bytes32 certHash);
    error NotAnchored(bytes32 certHash);
    error BadAction(uint8 action);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function addIssuer(address a) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ISSUER, a);
    }

    function flag(address subject, uint16 reason, bytes32 evidenceHash, uint64 expiry) external onlyRole(ISSUER) {
        if (subject == address(0)) revert ZeroValue();
        if (expiry != 0 && expiry <= block.timestamp) revert BadExpiry();
        if (_active(_flags[subject])) revert AlreadyFlagged(subject);
        _flags[subject] = Flag(msg.sender, reason, evidenceHash, expiry, false);
        emit Flagged(subject, msg.sender, reason, evidenceHash, expiry);
    }

    function revoke(address subject) external {
        Flag storage f = _flags[subject];
        if (!_active(f)) revert NotFlagged(subject);
        if (msg.sender != f.issuer && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotAllowed();
        f.revoked = true;
        emit Revoked(subject, msg.sender);
    }

    function isFlagged(address subject) external view returns (bool) {
        return _active(_flags[subject]);
    }

    function getFlag(address subject) external view returns (Flag memory f, bool active) {
        f = _flags[subject];
        active = _active(f);
    }

    function _active(Flag memory f) private view returns (bool) {
        return f.issuer != address(0) && !f.revoked && (f.expiry == 0 || f.expiry > block.timestamp);
    }

    function anchorCertificate(bytes32 certHash, address subject) external onlyRole(RELAYER) {
        if (certHash == bytes32(0)) revert ZeroValue();
        if (certificates[certHash].timestamp != 0) revert AlreadyAnchored(certHash);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 ts = uint64(block.timestamp);
        certificates[certHash] = Anchor(subject, ts);
        emit CertificateAnchored(certHash, subject, ts);
    }

    function logCustody(bytes32 certHash, uint8 action) external {
        if (certificates[certHash].timestamp == 0) revert NotAnchored(certHash);
        if (action != 1 && action != 2) revert BadAction(action);
        // forge-lint: disable-next-line(unsafe-typecast)
        emit CustodyLogged(certHash, msg.sender, action, uint64(block.timestamp));
    }
}
