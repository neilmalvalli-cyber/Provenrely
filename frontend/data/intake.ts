import type { Severity } from "./types";

export interface IntakePreset {
  label: string;
  address: string;
  riskScore: number;
  flags: { name: string; severity: Severity; description: string }[];
  summary: string;
}

export const INTAKE_PRESETS: IntakePreset[] = [
  {
    label: "Bridge exploiter",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    riskScore: 94,
    flags: [
      { name: "Unhosted bridge routing", severity: "critical", description: "Cross-chain bridge use without compliance handshake." },
      { name: "Rapid fan-out", severity: "high", description: "Value split across 48 wallets within 3 blocks." },
      { name: "Sanctions proximity", severity: "medium", description: "Second-degree link to a sanctioned deposit contract." },
    ],
    summary: "Value routed through decentralized bridges without compliance checks, followed by 48 rapid fan-out hops.",
  },
  {
    label: "Mixer interactor",
    address: "0x8576aCC5C05D6Ce88f4e49bf65BdF0C62F91353C",
    riskScore: 98,
    flags: [
      { name: "Sanctioned mixer interaction", severity: "critical", description: "Direct deposits to a sanctioned privacy pool." },
      { name: "Direct contract deposit", severity: "critical", description: "No intermediary hop before the mixer deposit." },
      { name: "No clean history", severity: "medium", description: "Account has no prior benign activity." },
    ],
    summary: "Repeated deposits to and withdrawals from a sanctioned privacy protocol.",
  },
  {
    label: "Phishing sweeper",
    address: "0x00004f291079D638bE6f9e8a83C74829E1208922",
    riskScore: 88,
    flags: [
      { name: "Batch ERC-20 draining", severity: "high", description: "Transfers fire immediately after victim approvals." },
      { name: "Malicious off-chain signature", severity: "high", description: "Permit2 signatures used to authorize drains." },
      { name: "Fast exchange off-ramp", severity: "medium", description: "Funds reach an exchange deposit within minutes." },
    ],
    summary: "Sweeper bot using compromised Permit2 signatures to drain tokens immediately after approval.",
  },
  {
    label: "Clean benchmark",
    address: "0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF",
    riskScore: 12,
    flags: [
      { name: "Long account tenure", severity: "low", description: "Active for more than six years." },
      { name: "No mixer intersections", severity: "low", description: "No exposure to flagged clusters within 3 hops." },
    ],
    summary: "Long-lived address with no exposure to flagged clusters. Useful as a control.",
  },
];

export const SCAN_STEPS = [
  { key: "snapshot", label: "Capturing chain snapshot", detail: "Pinning state at latest finalized block" },
  { key: "trace", label: "Reconstructing transaction graph", detail: "Following value two hops out" },
  { key: "cluster", label: "Clustering linked addresses", detail: "Common-input and timing heuristics" },
  { key: "risk", label: "Scoring exposure", detail: "Matching against sanctioned and flagged clusters" },
] as const;

export const SEAL_STEPS = [
  { key: "hash", label: "Hashing evidence bundle", detail: "SHA-256 over findings, traces and snapshot" },
  { key: "merkle", label: "Building Merkle tree", detail: "Leaves for every trace and attachment" },
  { key: "sign", label: "Signing with investigator key", detail: "ECDSA secp256k1" },
  { key: "anchor", label: "Anchoring root on-chain", detail: "Relayed to the evidence registry" },
  { key: "confirm", label: "Awaiting finality", detail: "Confirming inclusion" },
] as const;
