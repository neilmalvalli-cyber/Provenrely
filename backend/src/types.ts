/** API contract — mirrors backend/README.md and frontend/lib/api/types.ts. */

export type Hex = `0x${string}`;
export type Verdict = "SAFE" | "SUSPICIOUS" | "HIGH_RISK";
export type Language = "en" | "hi";
export type CustodyAction = "share" | "export";

export const VERDICTS: readonly Verdict[] = ["SAFE", "SUSPICIOUS", "HIGH_RISK"];
export const LANGUAGES: readonly Language[] = ["en", "hi"];

export interface ScanResult {
  address: string;
  verdict: Verdict;
  /** integer 0–100 */
  score: number;
  reasons: string[];
  /** ISO 8601 UTC, no milliseconds */
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
  flagsIssued: number | null;
  certificatesAnchored: number | null;
  /** Reverted SafeSend transfers leave no event, so this can't be counted from the chain yet. */
  transfersBlocked: number | null;
  updatedAt: string;
}

/** Error with an HTTP status and a message that is safe to show to users. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
export const isoFromUnix = (s: number | bigint) => new Date(Number(s) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
