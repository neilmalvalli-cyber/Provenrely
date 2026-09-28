import type { Verdict } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STYLE: Record<Verdict, { label: string; cls: string }> = {
  SAFE: { label: "Safe", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  SUSPICIOUS: { label: "Suspicious", cls: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
  HIGH_RISK: { label: "High risk", cls: "border-red-400/30 bg-red-500/10 text-red-200" },
};

/** Verdict pill — status colours only. */
export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const s = STYLE[verdict];
  return <span className={cn("inline-flex h-7 items-center rounded-full border px-3 text-[13px] font-medium", s.cls, className)}>{s.label}</span>;
}
