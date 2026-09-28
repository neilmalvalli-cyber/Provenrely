import { FileCheck2, Laptop, ShieldAlert, UserRound, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { AnchorGlyph, SealGlyph } from "@/components/brand/glyphs";
import { PRODUCT_NAME } from "@/lib/config/brand";
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
          <div className="mb-3 text-[12px] text-muted">Private — stays with whoever holds the certificate</div>
          <div className="flex flex-col lg:flex-row lg:items-stretch">
            <Node icon={<UserRound className="size-4" />} title="You" meta="Scan an address" />
            <div className="lg:hidden"><Arrow vertical /></div>
            <div className="hidden lg:flex"><Arrow /></div>
            <Node icon={<Laptop className="size-4" />} title={`${PRODUCT_NAME} console`} meta="Verdict, reasons, explanation" />
            <div className="lg:hidden"><Arrow vertical /></div>
            <div className="hidden lg:flex"><Arrow /></div>
            <Node icon={<FileCheck2 className="size-4" />} title="Certificate" meta="Fields + salt, exported as JSON" />
          </div>

          <div className="my-2 flex justify-center lg:justify-end lg:pr-[calc((100%-64px)/6)]">
            <Arrow vertical />
          </div>

          <div className="flex flex-col lg:flex-row-reverse lg:items-stretch">
            <Node tone="public" icon={<SealGlyph className="size-4" />} title="Certificate hash" meta="32 bytes, nothing personal" />
            <div className="lg:hidden"><Arrow vertical /></div>
            <div className="hidden lg:flex"><Arrow /></div>
            <Node tone="public" icon={<AnchorGlyph className="size-4" />} title="Registry on MST" meta="Anchors hashes, holds flags" />
            <div className="lg:hidden"><Arrow vertical /></div>
            <div className="hidden lg:flex"><Arrow /></div>
            <Node tone="public" icon={<ShieldAlert className="size-4" />} title="SafeSend" meta="Reverts transfers to flagged addresses" />
          </div>
          <div className="mt-3 text-[12px] text-muted lg:text-right">Public — only the fingerprint and fraud flags</div>
        </div>

        <div className="self-center border-t border-line pt-6 lg:w-60 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <Node icon={<UsersRound className="size-4" />} title="Anyone verifying" meta="Victim, bank, police, court" />
          <p className="mt-4 text-[12.5px] leading-relaxed text-fg-2">
            With the certificate file in hand, a verifier recomputes its hash and reads certificates(hash) on MST — no {PRODUCT_NAME} account and no
            trust in our servers required.
          </p>
        </div>
      </div>
    </div>
  );
}
