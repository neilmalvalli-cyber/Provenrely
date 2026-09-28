/** Proofs sealed during this browser session (demo only). */
export interface SessionSeal {
  caseId: string;
  evidence: string;
  merkle: string;
  tx: string;
  block: number;
  sealedAt: string;
  target: string;
}

const KEY = "solidity:session-seals";

export function readSessionSeals(): SessionSeal[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveSessionSeal(seal: SessionSeal) {
  try {
    const all = readSessionSeals().filter((s) => s.evidence !== seal.evidence);
    sessionStorage.setItem(KEY, JSON.stringify([seal, ...all].slice(0, 20)));
  } catch {
    /* storage unavailable — verification will just not find it */
  }
}
