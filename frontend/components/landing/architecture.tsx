import { Database, Laptop, Radio, UserRound, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { AnchorGlyph, MerkleGlyph } from "@/components/brand/glyphs";
import { cn } from "@/lib/utils";

function Node({ icon, title, meta, tone = "default" }: { icon: ReactNode; title: string; meta: string; tone?: "default" | "public" }) {
  return (
    <div
      className={cn(
        "relative z-10 flex items-center gap-3 rounded-xl border bg-panel px-4 py-3.5 lg:flex-1",
        tone === "public" ? "border-violet/30" : "border-line-strong",
      )}
    >
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone === "public" ? "bg-violet/10 text-violet-200" : "bg-white/[0.04] text-fg-2")}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] text-fg">{title}</div>
        <div className="truncate text-[11.5px] text-muted">{meta}</div>
      </div>
    </div>
  );
}

function Arrow({ vertical = false, dashed = false }: { vertical?: boolean; dashed?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center", vertical ? "h-8" : "h-full w-8 shrink-0")} aria-hidden>
      <span
        className={cn(
          vertical ? "h-full w-px" : "h-px w-full",
          dashed ? (vertical ? "border-l border-dashed border-line-strong" : "border-t border-dashed border-line-strong") : "bg-line-strong",
        )}
      />
    </div>
  );
}

/** Where data lives: private lane above, public lane below. */
export function Architecture() {
  return (
    <div className="glass rounded-3xl p-5 sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-3 text-[12px] text-muted">Private — stays with your organization</div>
          <div className="flex flex-col lg:flex-row lg:items-stretch">
            <Node icon={<UserRound className="size-4" />} title="Investigator" meta="Reviews and approves" />
            <div className="lg:hidden"><Arrow vertical /></div>
            <div className="hidden lg:flex"><Arrow /></div>
            <Node icon={<Laptop className="size-4" />} title="Solidity console" meta="Trace, flag, seal" />
            <div className="lg:hidden"><Arrow vertical /></div>
            <div className="hidden lg:flex"><Arrow /></div>
            <Node icon={<Database className="size-4" />} title="Evidence bundle" meta="Encrypted storage" />
          </div>

          <div className="my-2 flex justify-center lg:justify-end lg:pr-[calc((100%-64px)/6)]">
            <Arrow vertical />
          </div>

          <div className="flex flex-col lg:flex-row-reverse lg:items-stretch">
            <Node tone="public" icon={<MerkleGlyph className="size-4" />} title="Merkle root" meta="32 bytes, no case data" />
            <div className="lg:hidden"><Arrow vertical /></div>
            <div className="hidden lg:flex"><Arrow /></div>
            <Node tone="public" icon={<Radio className="size-4" />} title="Relayer" meta="Submits the anchor" />
            <div className="lg:hidden"><Arrow vertical /></div>
            <div className="hidden lg:flex"><Arrow /></div>
            <Node tone="public" icon={<AnchorGlyph className="size-4" />} title="Registry contract" meta="Ethereum" />
          </div>
          <div className="mt-3 text-[12px] text-muted lg:text-right">Public — only a fingerprint leaves</div>
        </div>

        <div className="self-center border-t border-line pt-6 lg:w-60 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <Node icon={<UsersRound className="size-4" />} title="Anyone verifying" meta="Court, counterparty, auditor" />
          <p className="mt-4 text-[12.5px] leading-relaxed text-fg-2">
            With the evidence bundle in hand, a verifier recomputes the root and compares it with the registry — no Solidity account and no trust in
            our servers required.
          </p>
        </div>
      </div>
    </div>
  );
}
