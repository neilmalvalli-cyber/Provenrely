export interface Activity {
  id: string;
  at: string;
  kind: "seal" | "flag" | "trace" | "verify" | "intake" | "export";
  text: string;
  caseId?: string;
}

export const ACTIVITY: Activity[] = [
  { id: "a1", at: "2026-09-26T07:12:30Z", kind: "intake", text: "Case opened by Elena Rostova", caseId: "PR-4381" },
  { id: "a2", at: "2026-09-26T06:58:02Z", kind: "verify", text: "Anchor re-verified at block 6,912,884", caseId: "PR-6420" },
  { id: "a3", at: "2026-09-25T08:31:19Z", kind: "seal", text: "Evidence sealed · Merkle root anchored", caseId: "PR-6420" },
  { id: "a4", at: "2026-09-25T08:19:44Z", kind: "flag", text: "Sanctioned counterparty detected", caseId: "PR-6420" },
  { id: "a5", at: "2026-09-24T14:51:30Z", kind: "trace", text: "37 linked addresses clustered", caseId: "PR-5507" },
  { id: "a6", at: "2026-09-23T09:02:17Z", kind: "export", text: "Evidence digest exported", caseId: "PR-7719" },
];

/** Daily sealed-evidence counts, last 14 days. */
export const SEAL_SERIES = [3, 5, 4, 6, 5, 8, 7, 6, 9, 8, 11, 9, 12, 14];

export const RELAYERS = [
  { name: "sldt-relayer-01.eth", region: "eu-west", latencyMs: 1190, status: "online" as const },
  { name: "sldt-relayer-02.eth", region: "us-east", latencyMs: 1102, status: "online" as const },
  { name: "sldt-relayer-03.eth", region: "ap-south", latencyMs: 1320, status: "degraded" as const },
  { name: "sldt-relayer-04.eth", region: "us-west", latencyMs: 1284, status: "online" as const },
];

/** 90 days of sealed-evidence counts ending 26 Sep 2026 (deterministic demo series). */
export const SEAL_DAILY: { date: string; count: number }[] = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 26) - (89 - i) * 86_400_000);
  const trend = 2 + i * 0.11;
  const weekly = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? -2.2 : 0.6;
  const wobble = Math.sin(i * 1.7) * 1.4 + Math.cos(i * 0.6) * 1.1;
  return { date: d.toISOString().slice(0, 10), count: Math.max(0, Math.round(trend + weekly + wobble)) };
});
