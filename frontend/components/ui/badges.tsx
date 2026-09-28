import { cn } from "@/lib/utils";
import type { CaseStatus, Severity } from "@/data/types";

const STATUS: Record<CaseStatus, { label: string; dot: string; cls: string }> = {
  sealed: { label: "Sealed", dot: "bg-ok shadow-[0_0_6px_rgba(52,199,123,0.8)]", cls: "text-emerald-300/90 border-emerald-400/15 bg-emerald-400/[0.05]" },
  review: { label: "In review", dot: "bg-warn", cls: "text-amber-200/90 border-amber-300/15 bg-amber-300/[0.05]" },
  flagged: { label: "Sanction flagged", dot: "bg-danger", cls: "text-red-300/90 border-red-400/15 bg-red-400/[0.05]" },
  draft: { label: "Draft", dot: "bg-muted", cls: "text-fg-2 border-line-strong bg-white/[0.02]" },
};

export function StatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12.5px] font-medium",
        s.cls,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export const SEVERITY: Record<Severity, { label: string; color: string; cls: string }> = {
  critical: { label: "Critical", color: "#EF5B5B", cls: "text-red-300/90 border-red-400/20 bg-red-500/[0.06]" },
  high: { label: "High", color: "#F0A940", cls: "text-amber-200/90 border-amber-300/20 bg-amber-400/[0.06]" },
  medium: { label: "Medium", color: "#A4A9B4", cls: "text-fg-2 border-line-strong bg-white/[0.03]" },
  low: { label: "Low", color: "#5E6572", cls: "text-muted border-line bg-transparent" },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const s = SEVERITY[severity];
  return (
    <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[11.5px] font-medium", s.cls, className)}>
      {s.label}
    </span>
  );
}

export function riskTone(score: number) {
  if (score >= 90) return { color: "#EF5B5B", label: "Severe", text: "text-red-300/90" };
  if (score >= 70) return { color: "#F0A940", label: "Elevated", text: "text-amber-200/90" };
  if (score >= 40) return { color: "#A4A9B4", label: "Moderate", text: "text-fg-2" };
  return { color: "#34C77B", label: "Low", text: "text-emerald-300/90" };
}

export function RiskBadge({ score, className }: { score: number; className?: string }) {
  const t = riskTone(score);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative h-1 w-10 overflow-hidden rounded-full bg-white/[0.07]">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${score}%`, background: t.color }} />
      </span>
      <span className={cn("font-mono text-[13px] tabular-nums", t.text)}>{score}</span>
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border border-line-strong px-2.5 text-[12px] text-fg-2",
        className,
      )}
      title="API responses are simulated (NEXT_PUBLIC_USE_MOCKS=true); on-chain reads are live"
    >
      <span className="size-1.5 rounded-full bg-cyan" />
      Sample data
    </span>
  );
}
