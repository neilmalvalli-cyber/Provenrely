import { zeroAddress, type Address } from "viem";
import type { FlagEvent, FlagRecord, RevokeEvent } from "./registry";

/**
 * Flag reason codes (the registry stores a uint16). Source of truth, mirrored in backend/README.md —
 * the backend and contract use exactly these numbers; change both together. Unknown codes show as "Reason <n>".
 */
export const FLAG_REASONS: { code: number; label: string }[] = [
  { code: 1, label: "Phishing" },
  { code: 2, label: "Investment scam" },
  { code: 3, label: "Impersonation" },
  { code: 4, label: "Ransomware" },
  { code: 5, label: "Money mule" },
  { code: 6, label: "Stolen funds" },
  { code: 99, label: "Other" },
];

export const reasonLabel = (code: number) => FLAG_REASONS.find((r) => r.code === code)?.label ?? `Reason ${code}`;

const nowSec = () => BigInt(Math.floor(Date.now() / 1000));

/** A getFlag() result is active when it exists, isn't revoked and hasn't expired (expiry 0 = no expiry). */
export function isActiveFlag(f: FlagRecord): boolean {
  return f.issuer !== zeroAddress && !f.revoked && (f.expiry === 0n || f.expiry > nowSec());
}

/**
 * Current flags from the event history: the latest Flagged event per subject, dropped if a Revoked
 * event for that subject came at or after it, or if it has expired. Newest first.
 */
export function activeFlagsFromEvents(flags: FlagEvent[], revokes: RevokeEvent[]): FlagEvent[] {
  const latest = new Map<Address, FlagEvent>();
  for (const f of flags) {
    const key = f.subject.toLowerCase() as Address;
    const prev = latest.get(key);
    if (!prev || f.blockNumber >= prev.blockNumber) latest.set(key, f);
  }
  const now = nowSec();
  return [...latest.values()]
    .filter((f) => !revokes.some((r) => r.subject.toLowerCase() === f.subject.toLowerCase() && r.blockNumber >= f.blockNumber))
    .filter((f) => f.expiry === 0n || f.expiry > now)
    .sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));
}
