export type Severity = "critical" | "high" | "medium" | "low";

export type CaseStatus = "sealed" | "review" | "flagged" | "draft";

export interface RiskFlag {
  id: string;
  name: string;
  severity: Severity;
  description: string;
}

export interface TimelineEvent {
  at: string; // ISO
  kind: "intake" | "trace" | "flag" | "seal" | "verify" | "export" | "note";
  title: string;
  detail: string;
  actor: string;
  ref?: string;
}

export interface EvidenceRecord {
  proofHash: string;
  merkleRoot: string;
  signature: string;
  anchorTx: string;
  contract: string;
  blockHeight: number;
  gasUsed: number;
  relayer: string;
  epoch: number;
  proofType: string;
  sealLatencyMs: number;
}

export interface Investigator {
  name: string;
  role: string;
  unit: string;
  initials: string;
}

export interface Case {
  id: string;
  title: string;
  category: string;
  summary: string;
  status: CaseStatus;
  openedAt: string;
  sealedAt?: string;
  lead: Investigator;
  target: string;
  chain: string;
  preservationBasis: string;
  riskScore: number;
  riskFlags: RiskFlag[];
  valueTracedEth: number;
  txCount: number;
  linkedAddresses: number;
  evidence: EvidenceRecord;
  timeline: TimelineEvent[];
}

export type NodeKind = "target" | "wallet" | "mixer" | "bridge" | "exchange" | "contract";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  address: string;
  x: number; // 0..1000
  y: number; // 0..600
  risk: number;
  balanceEth: number;
  txCount: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  valueEth: number;
  txs: number;
  hop: number;
}
