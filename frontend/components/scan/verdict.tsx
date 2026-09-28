import type { Verdict } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const VERDICT_LABEL: Record<Verdict, string> = { SAFE: "Safe", SUSPICIOUS: "Suspicious", HIGH_RISK: "High risk" };
const DOT: Record<Verdict, string> = { SAFE: "bg-ok", SUSPICIOUS: "bg-warn", HIGH_RISK: "bg-danger" };

/** Verdict badge: a muted pill with a status-coloured dot. */
export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[13px] font-medium text-fg-2", className)}>
      <span className={cn("size-2 rounded-full", DOT[verdict])} />
      {VERDICT_LABEL[verdict]}
    </span>
  );
}
