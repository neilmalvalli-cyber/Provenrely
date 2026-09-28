/** API contract — mirrors backend/README.md. */

export type Hex = `0x${string}`;
export type Verdict = "SAFE" | "SUSPICIOUS" | "HIGH_RISK";
export type Language = "en" | "hi";
export type CustodyAction = "share" | "export";

export interface ScanResult {
  address: string;
  verdict: Verdict;
  /** integer 0–100 */
  score: number;
  reasons: string[];
  /** ISO 8601 UTC */
  scannedAt: string;
}

export interface ExplainRequest {
  address: string;
  verdict: Verdict;
  score: number;
  reasons: string[];
  language: Language;
}

export interface Explanation {
  language: Language;
  explanation: string;
  nextSteps: string[];
}

/** Everything that is hashed. Integers only, no null, ISO timestamps, ASCII keys. */
export interface CertificateBody {
  schemaVersion: number;
  address: string;
  verdict: Verdict;
  score: number;
  reasons: string[];
  scannedAt: string;
  issuer: string;
  language?: Language;
  note?: string;
}

export interface CertificateAnchor {
  certHash: Hex;
  txHash: Hex;
  blockNumber: number;
  blockTimestamp: string;
}

export interface Certificate {
  id: string;
  body: CertificateBody;
  /** 64 lowercase hex chars, no 0x */
  salt: string;
  /** Added after anchoring; never hashed. */
  anchor?: CertificateAnchor;
}

export interface CustodyReceipt {
  certHash: Hex;
  action: CustodyAction;
  txHash: Hex;
  timestamp: string;
}

export interface Stats {
  /** null = not available (e.g. registry not configured); the UI shows "—". */
  flagsIssued: number | null;
  certificatesAnchored: number | null;
  /** Reverted SafeSend transfers leave no event, so the backend can't count these yet (null). */
  transfersBlocked: number | null;
  updatedAt: string;
}

export const VERDICTS: readonly Verdict[] = ["SAFE", "SUSPICIOUS", "HIGH_RISK"];
