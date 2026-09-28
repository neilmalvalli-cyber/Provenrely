/** Flag reason codes — same table as backend/README.md and frontend/lib/chain/flags.ts (FLAG_REASONS). */
export const FLAG_REASONS: Record<number, string> = {
  1: "Phishing",
  2: "Investment scam",
  3: "Impersonation",
  4: "Ransomware",
  5: "Money mule",
  6: "Stolen funds",
  99: "Other",
};

export const reasonLabel = (code: number) => FLAG_REASONS[code] ?? `Reason ${code}`;
