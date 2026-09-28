import { BadgeCheck } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { StatusBadge } from "@/components/ui/badges";
import { HashDisplay } from "@/components/ui/hash-display";
import { GlassPanel } from "@/components/ui/panel";
import type { Case } from "@/data/types";
import { cn, formatNumber, formatUtc, shortHash } from "@/lib/utils";
import { HashRing } from "./hash-ring";

export function ProofCard({ c, compact = false, decode = false, className }: { c: Case; compact?: boolean; decode?: boolean; className?: string }) {
  const e = c.evidence;
  return (
    <GlassPanel glow className={cn("overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <LogoMark className="h-8" />
          <div>
            <div className="text-[12px] text-muted">Evidence attestation</div>
            <div className="font-mono text-[13px] text-fg">{c.id}</div>
          </div>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <div className="grid gap-6 px-5 py-5 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-5">
          <div>
            <div className="text-[17px] font-medium tracking-[-0.01em] text-fg">{c.title}</div>
            <div className="mt-1 text-[12.5px] text-fg-2">
              {c.lead.name} · {c.lead.unit}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="Target" mono value={shortHash(c.target, 8, 6)} />
            <Field label="Block" mono value={`#${formatNumber(e.blockHeight)}`} />
            <Field label="Network" value={c.chain} />
            {!compact && (
              <>
                <Field label="Sealed" mono value={c.sealedAt ? formatUtc(c.sealedAt).slice(0, 16) : "Not sealed"} />
                <Field label="Relayer" mono value={e.relayer} />
                <Field label="Proof" value={e.proofType} />
              </>
            )}
          </div>
        </div>
        <HashRing hash={e.proofHash} className="hidden md:block" />
      </div>

      <div className="space-y-3 border-t border-line bg-black/20 px-5 py-5 sm:px-6">
        <HashDisplay label="Evidence hash" value={e.proofHash} decode={decode} />
        {!compact && <HashDisplay label="Merkle root" value={e.merkleRoot} decode={decode} />}
        <div className="flex items-center gap-2 pt-1 text-[12.5px] text-emerald-300/90">
          <BadgeCheck className="size-4" />
          {c.sealedAt ? "Inclusion proof matches the on-chain root" : "Awaiting seal — proof not yet anchored"}
        </div>
      </div>
    </GlassPanel>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11.5px] text-muted">{label}</div>
      <div className={cn("truncate text-[12.5px] text-fg", mono && "font-mono text-[12px]")}>{value}</div>
    </div>
  );
}
