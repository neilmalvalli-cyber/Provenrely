import { mockHash } from "@/lib/utils";
import { INVESTIGATORS } from "./investigators";
import type { Case, TimelineEvent } from "./types";

/**
 * DEMO DATA. Every case, investigator, hash and transaction below is
 * fictional and exists only to populate the interface.
 */

const REGISTRY = "0x4829f4a1c3e0b7d95a2e6c1f08b3d47a92e5cc08";

function evidence(id: string, blockHeight: number, gasUsed: number, relayer: number, epoch: number, latency: number) {
  return {
    proofHash: mockHash(`proof-${id}`),
    merkleRoot: mockHash(`merkle-${id}`),
    signature: mockHash(`sig-${id}`, 65),
    anchorTx: mockHash(`tx-${id}`),
    contract: REGISTRY,
    blockHeight,
    gasUsed,
    relayer: `sldt-relayer-0${relayer}.eth`,
    epoch,
    proofType: "Merkle inclusion + ECDSA",
    sealLatencyMs: latency,
  };
}

function timeline(c: {
  id: string;
  openedAt: string;
  sealedAt?: string;
  lead: string;
  flags: number;
  hops: number;
}): TimelineEvent[] {
  const t0 = new Date(c.openedAt).getTime();
  const at = (min: number) => new Date(t0 + min * 60_000).toISOString();
  const events: TimelineEvent[] = [
    { at: at(0), kind: "intake", title: "Case opened", detail: "Target address registered and chain snapshot requested.", actor: c.lead },
    { at: at(3), kind: "trace", title: "Transaction graph reconstructed", detail: `${c.hops} linked addresses traced across two hops.`, actor: "Trace engine" },
    { at: at(9), kind: "flag", title: `${c.flags} risk indicator${c.flags === 1 ? "" : "s"} raised`, detail: "Heuristics matched against known exposure clusters.", actor: "Risk engine" },
  ];
  if (c.sealedAt) {
    const sealed = new Date(c.sealedAt).getTime();
    events.push(
      { at: new Date(sealed - 4 * 60_000).toISOString(), kind: "note", title: "Findings approved", detail: "Summary and indicators reviewed and signed off.", actor: c.lead },
      { at: c.sealedAt, kind: "seal", title: "Evidence sealed", detail: "Merkle root anchored to the evidence registry.", actor: "Relayer", ref: mockHash(`tx-${c.id}`) },
      { at: new Date(sealed + 90_000).toISOString(), kind: "verify", title: "Anchor verified", detail: "Inclusion proof recomputed and matched the on-chain root.", actor: "Verifier" },
    );
  }
  return events;
}

export const CASES: Case[] = [
  {
    id: "PR-8842",
    title: "Unhosted bridge routing",
    category: "Bridge exploit",
    summary:
      "Funds moved from the target through non-custodial cross-chain bridges without standard compliance checks, then split across 48 wallets within three blocks. Balances, execution traces and contract state were reconciled and sealed into a single Merkle root.",
    status: "sealed",
    openedAt: "2026-09-14T03:21:40Z",
    sealedAt: "2026-09-14T03:44:12Z",
    lead: INVESTIGATORS.vance,
    target: "0x71c7656ec7ab88b098defb751b7401b5f6d8976f",
    chain: "Ethereum · Sepolia",
    preservationBasis: "Preservation request 2026-114",
    riskScore: 94,
    riskFlags: [
      { id: "f1", name: "Unhosted bridge routing", severity: "critical", description: "Value routed through cross-chain bridge contracts without compliance handshakes." },
      { id: "f2", name: "Rapid fan-out", severity: "high", description: "Outgoing value split across 48 wallets within 3 blocks." },
      { id: "f3", name: "Sanctions proximity", severity: "medium", description: "Second-degree link to a sanctioned mixer deposit contract." },
    ],
    valueTracedEth: 1842.6,
    txCount: 312,
    linkedAddresses: 48,
    evidence: evidence("PR-8842", 6892118, 48120, 4, 216401, 1284),
    timeline: timeline({ id: "PR-8842", openedAt: "2026-09-14T03:21:40Z", sealedAt: "2026-09-14T03:44:12Z", lead: "Marcus Vance", flags: 3, hops: 48 }),
  },
  {
    id: "PR-7719",
    title: "Flash-loan liquidity drain",
    category: "DeFi exploit",
    summary:
      "Reconstruction of a recursive flash-loan attack that skewed collateral pricing and drained pool reserves across 14 consecutive internal calls. Part of the proceeds were deposited into a sanctioned mixer.",
    status: "sealed",
    openedAt: "2026-09-18T10:58:02Z",
    sealedAt: "2026-09-18T11:20:04Z",
    lead: INVESTIGATORS.rostova,
    target: "0x39a7b82e4f0c61d5a8b3e97c2f14d06ab5e1e7c1",
    chain: "Ethereum · Sepolia",
    preservationBasis: "Preservation request 2026-121",
    riskScore: 98,
    riskFlags: [
      { id: "f1", name: "Flash-loan price manipulation", severity: "critical", description: "$42M borrowed and repaid in a single atomic transaction to skew collateral price." },
      { id: "f2", name: "Direct mixer deposit", severity: "critical", description: "100 ETH deposited directly into a sanctioned mixer contract." },
    ],
    valueTracedEth: 11620.4,
    txCount: 74,
    linkedAddresses: 16,
    evidence: evidence("PR-7719", 6899432, 52440, 2, 216780, 1102),
    timeline: timeline({ id: "PR-7719", openedAt: "2026-09-18T10:58:02Z", sealedAt: "2026-09-18T11:20:04Z", lead: "Elena Rostova", flags: 2, hops: 16 }),
  },
  {
    id: "PR-9012",
    title: "Permit2 phishing sweeper",
    category: "Phishing",
    summary:
      "Victim approvals were swept through a malicious off-chain Permit2 signature, consolidated via a multi-sig relayer and partially off-ramped to an exchange deposit address. Being prepared to support a cross-border freeze request.",
    status: "review",
    openedAt: "2026-09-22T19:05:43Z",
    lead: INVESTIGATORS.oconnor,
    target: "0x1129bbc07e3d92f4a61c5b8e0d7f3a24c6e0f441",
    chain: "Ethereum · Sepolia",
    preservationBasis: "Freeze request (draft)",
    riskScore: 89,
    riskFlags: [
      { id: "f1", name: "Batch drain sweeper", severity: "high", description: "Transfers executed immediately after each victim ERC-20 approval." },
      { id: "f2", name: "Exchange off-ramp", severity: "medium", description: "Partial liquidation to an unverified exchange deposit tag." },
    ],
    valueTracedEth: 214.9,
    txCount: 1288,
    linkedAddresses: 9,
    evidence: evidence("PR-9012", 6904120, 46800, 4, 217104, 1415),
    timeline: timeline({ id: "PR-9012", openedAt: "2026-09-22T19:05:43Z", lead: "Devlin O'Connor", flags: 2, hops: 9 }),
  },
  {
    id: "PR-6420",
    title: "L2 bridge reentrancy",
    category: "Bridge exploit",
    summary:
      "Reentrancy against bridge liquidity-provider vaults minted unbacked synthetic assets before the contract was paused. The root hash was anchored ahead of the pause to fix the pre-incident state.",
    status: "flagged",
    openedAt: "2026-09-25T08:10:51Z",
    sealedAt: "2026-09-25T08:31:19Z",
    lead: INVESTIGATORS.vance,
    target: "0x00d892f6ab3e71c4d0985e2fb17a6c3d94e218cb",
    chain: "Ethereum · Sepolia",
    preservationBasis: "Sanctions exposure record",
    riskScore: 99,
    riskFlags: [
      { id: "f1", name: "Sanctioned counterparty", severity: "critical", description: "Received seed funding from a cluster tagged as sanctioned." },
      { id: "f2", name: "Oracle manipulation", severity: "critical", description: "Flash loan used to move oracle prices across three pools." },
    ],
    valueTracedEth: 5230.0,
    txCount: 146,
    linkedAddresses: 22,
    evidence: evidence("PR-6420", 6912884, 49300, 1, 217890, 1190),
    timeline: timeline({ id: "PR-6420", openedAt: "2026-09-25T08:10:51Z", sealedAt: "2026-09-25T08:31:19Z", lead: "Marcus Vance", flags: 2, hops: 22 }),
  },
  {
    id: "PR-5507",
    title: "Pig-butchering deposit cluster",
    category: "Investment fraud",
    summary:
      "Victim deposits were aggregated through a ring of short-lived wallets before reaching an OTC desk. Clustering is complete; awaiting analyst review before sealing.",
    status: "review",
    openedAt: "2026-09-24T14:42:09Z",
    lead: INVESTIGATORS.park,
    target: "0x5e07a91c3b2d84f6e0a1c9d72b6f35e8a04c19d2",
    chain: "Ethereum · Sepolia",
    preservationBasis: "Victim complaint 88-3104",
    riskScore: 81,
    riskFlags: [
      { id: "f1", name: "Peel-chain aggregation", severity: "high", description: "Repeated small peel transfers into a single consolidation wallet." },
      { id: "f2", name: "OTC desk exposure", severity: "medium", description: "Final hop to an unlicensed over-the-counter desk." },
      { id: "f3", name: "New-wallet churn", severity: "low", description: "Most intermediary wallets active for under 48 hours." },
    ],
    valueTracedEth: 406.3,
    txCount: 522,
    linkedAddresses: 37,
    evidence: evidence("PR-5507", 6915402, 47010, 3, 218012, 1320),
    timeline: timeline({ id: "PR-5507", openedAt: "2026-09-24T14:42:09Z", lead: "Hana Park", flags: 3, hops: 37 }),
  },
  {
    id: "PR-4381",
    title: "Validator key compromise",
    category: "Infrastructure",
    summary:
      "Withdrawal credentials were changed after a validator key leak. Draft case with an initial trace only; no indicators confirmed yet.",
    status: "draft",
    openedAt: "2026-09-26T07:12:30Z",
    lead: INVESTIGATORS.rostova,
    target: "0x43816cd09a2e5f7b1c84d3e60f9a2b57c1de0e8a",
    chain: "Ethereum · Sepolia",
    preservationBasis: "Pending",
    riskScore: 42,
    riskFlags: [
      { id: "f1", name: "Credential change", severity: "low", description: "Withdrawal address updated 6 minutes after anomalous signing activity." },
    ],
    valueTracedEth: 64.0,
    txCount: 11,
    linkedAddresses: 3,
    evidence: evidence("PR-4381", 6918220, 0, 2, 218190, 0),
    timeline: timeline({ id: "PR-4381", openedAt: "2026-09-26T07:12:30Z", lead: "Elena Rostova", flags: 1, hops: 3 }),
  },
];

export function getCase(id: string) {
  return CASES.find((c) => c.id.toLowerCase() === id.toLowerCase());
}

export function getCases() {
  return CASES;
}
