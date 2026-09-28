"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { FilePlus2, FolderKanban, LayoutGrid, Network, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { MiniGraph } from "@/components/explorer/mini-graph";
import { RiskBadge, StatusBadge } from "@/components/ui/badges";
import { getCases } from "@/data/cases";
import { cn, formatNumber, shortHash } from "@/lib/utils";

/**
 * The real console, framed in a window and tilting upright as it scrolls in.
 * Built from the product's own components — not a screenshot.
 */
export function ProductShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.35], [reduce ? 1 : 0.2, 1]);

  const cases = getCases();
  const c = cases[0];

  return (
    <div ref={ref} className="relative mx-auto max-w-6xl" style={{ perspective: 1600 }}>
      <div aria-hidden className="absolute -inset-x-10 -bottom-10 top-1/3 rounded-[48px] bg-[radial-gradient(closest-side,rgba(109,74,232,0.25),transparent)] blur-2xl" />
      <motion.div
        style={{ rotateX, scale, opacity, transformOrigin: "50% 100%" }}
        className="relative overflow-hidden rounded-[20px] border border-line-strong bg-base shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_60px_120px_-40px_rgba(0,0,0,0.9)]"
      >
        {/* window chrome */}
        <div className="flex h-10 items-center gap-2 border-b border-line bg-panel/80 px-4">
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
          <div className="mx-auto rounded-md bg-white/[0.04] px-3 py-1 font-mono text-[10.5px] text-muted">console / cases / {c.id}</div>
          <span className="w-12" />
        </div>

        <div className="flex">
          {/* sidebar */}
          <div className="hidden w-48 shrink-0 flex-col gap-0.5 border-r border-line p-3 md:flex">
            <div className="mb-4 px-2 pt-1">
              <LogoMark className="h-7" />
            </div>
            {[
              [LayoutGrid, "Overview"],
              [FolderKanban, "Case ledger"],
              [FilePlus2, "New intake"],
              [Network, "Explorer"],
              [ShieldCheck, "Verify proof"],
            ].map(([Icon, label], i) => {
              const I = Icon as typeof LayoutGrid;
              return (
                <div
                  key={label as string}
                  className={cn("flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[12px]", i === 1 ? "bg-white/[0.06] text-fg" : "text-muted")}
                >
                  <I className="size-3.5" />
                  {label as string}
                </div>
              );
            })}
          </div>

          {/* main */}
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-[12px] text-violet-300">{c.id}</span>
              <StatusBadge status={c.status} />
            </div>
            <div className="mt-2 text-[20px] font-medium tracking-[-0.02em] text-fg">{c.title}</div>

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[
                ["Value traced", `${formatNumber(c.valueTracedEth)} ETH`],
                ["Transactions", formatNumber(c.txCount)],
                ["Risk", String(c.riskScore)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-white/[0.02] p-3">
                  <div className="text-[10.5px] text-muted">{k}</div>
                  <div className="mt-1 font-mono text-[14px] text-fg">{v}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
              <div className="overflow-hidden rounded-xl border border-line">
                <MiniGraph caseId={c.id} target={c.target} risk={c.riskScore} />
              </div>
              <div className="rounded-xl border border-line">
                <div className="border-b border-line px-3.5 py-2.5 text-[12px] text-fg">Recent cases</div>
                {cases.slice(1, 6).map((x) => (
                  <div key={x.id} className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5 last:border-0">
                    <div className="min-w-0">
                      <div className="font-mono text-[10.5px] text-violet-300">{x.id}</div>
                      <div className="truncate text-[11.5px] text-fg-2">{x.title}</div>
                    </div>
                    <div className="hidden sm:block">
                      <RiskBadge score={x.riskScore} />
                    </div>
                  </div>
                ))}
                <div className="px-3.5 py-2.5 font-mono text-[10px] text-muted">root {shortHash(c.evidence.merkleRoot, 8, 6)}</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
