/**
 * Provenrely registry on MST Testnet — placeholder ABI matching the agreed interface
 * (backend/README.md). Replace with the compiled ABI once deployed; keep `as const` for viem typing.
 */
export const registryAbi = [
  {
    type: "function",
    name: "flag",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subject", type: "address" },
      { name: "reason", type: "uint16" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [],
  },
  { type: "function", name: "revoke", stateMutability: "nonpayable", inputs: [{ name: "subject", type: "address" }], outputs: [] },
  { type: "function", name: "isFlagged", stateMutability: "view", inputs: [{ name: "subject", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  {
    type: "function",
    name: "getFlag",
    stateMutability: "view",
    inputs: [{ name: "subject", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "issuer", type: "address" },
          { name: "reason", type: "uint16" },
          { name: "evidenceHash", type: "bytes32" },
          { name: "expiry", type: "uint64" },
          { name: "revoked", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "anchorCertificate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "certHash", type: "bytes32" },
      { name: "subject", type: "address" },
    ],
    outputs: [],
  },
  // OpenZeppelin AccessControl: issuers hold ISSUER_ROLE
  { type: "function", name: "ISSUER_ROLE", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  { type: "function", name: "anchoredAt", stateMutability: "view", inputs: [{ name: "certHash", type: "bytes32" }], outputs: [{ name: "", type: "uint64" }] },
  {
    type: "function",
    name: "logCustody",
    stateMutability: "nonpayable",
    inputs: [
      { name: "certHash", type: "bytes32" },
      { name: "action", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Flagged",
    inputs: [
      { name: "subject", type: "address", indexed: true },
      { name: "issuer", type: "address", indexed: true },
      { name: "reason", type: "uint16", indexed: false },
      { name: "evidenceHash", type: "bytes32", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Revoked",
    inputs: [
      { name: "subject", type: "address", indexed: true },
      { name: "by", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "CertificateAnchored",
    inputs: [
      { name: "certHash", type: "bytes32", indexed: true },
      { name: "subject", type: "address", indexed: true },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CustodyLogged",
    inputs: [
      { name: "certHash", type: "bytes32", indexed: true },
      { name: "actor", type: "address", indexed: true },
      { name: "action", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
] as const;

/** Custody actions as stored on-chain. */
export const CUSTODY_ACTION = { share: 1, export: 2 } as const;
