"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Flag, LayoutGrid, Plus, ScanSearch, ShieldAlert, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const NAV = [
  [LayoutGrid, "Dashboard"],
  [ScanSearch, "Scan"],
  [ShieldCheck, "Verify"],
  [ShieldAlert, "Shield"],
  [Flag, "Issuer"],
] as const;

const REASONS = ["Received funds from a flagged address", "Sent to 14 new wallets within 10 minutes", "Linked to a reported investment scam"];

/**
 * A miniature of the console's Scan page (example data), framed in a window and tilting upright as it scrolls in.
 */
export function ProductShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.35], [reduce ? 1 : 0.2, 1]);

  return (
    <div ref={ref} className="relative mx-auto max-w-6xl" style={{ perspective: 1600 }}>
      <motion.div
        style={{ rotateX, scale, opacity, transformOrigin: "50% 100%" }}
        className="glass-shell relative overflow-hidden p-3 shadow-[0_60px_120px_-40px_rgba(40,38,60,0.45)]"
      >
        <div className="flex gap-3">
          {/* sidebar */}
          <div className="hidden w-44 shrink-0 flex-col rounded-[20px] bg-[#fff] p-3 shadow-[var(--shadow-card)] md:flex">
            <div className="mb-5 px-1 pt-1 text-[#0b0b0c]">
              <Logo className="[&_img]:h-7 [&_span]:text-[11px]" />
            </div>
            {NAV.map(([Icon, label]) => (
              <div
                key={label}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-full px-3 text-[12px] font-medium",
                  label === "Scan" ? "bg-[#0b0b0c] text-[#fff]" : "text-fg-2",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </div>
            ))}
          </div>

          {/* main */}
          <div className="min-w-0 flex-1 p-2 sm:p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10.5px] text-muted">Tools</div>
                <div className="text-[20px] font-semibold tracking-[-0.03em] text-fg">Scan</div>
              </div>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#0b0b0c] px-3 text-[11px] font-medium text-[#fff]">
                <Plus className="size-3" /> New scan
              </span>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-[18px] bg-[#fff] p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between text-[10.5px] text-muted">
                  <span>Verdict</span>
                  <span>Example</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[30px] font-semibold leading-none tracking-[-0.035em] text-fg">High risk</span>
                  <span className="inline-flex h-5 items-center gap-1 rounded-full border border-line-strong px-2 text-[10px] font-medium text-fg-2">
                    <span className="size-1.5 rounded-full bg-danger" /> High risk
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {REASONS.map((r) => (
                    <li key={r} className="flex gap-2 text-[11.5px] text-fg-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-fg-2" />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
                  <span className="font-mono text-[10px] text-muted">0x8ba1…BA72</span>
                  <span className="text-[18px] font-semibold tabular-nums text-fg">
                    90<span className="text-[11px] font-medium text-muted"> / 100</span>
                  </span>
                </div>
              </div>

              <div className="console-dark flex flex-col justify-between rounded-[18px] bg-[#0b0b0c] p-4 text-fg">
                <div>
                  <div className="text-[13px] font-semibold">Issue a certificate</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">Seal this verdict. Only its hash goes on MST, so anyone can check it later.</p>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between rounded-[12px] bg-white/[0.07] px-3 py-2 text-[10.5px]">
                    <span className="text-muted">Hash</span>
                    <span className="font-mono text-fg">0x89e1…7c4a</span>
                  </div>
                  <span className="inline-flex h-7 items-center rounded-full bg-[#fff] px-3 text-[11px] font-medium text-[#0b0b0c]">Issue certificate</span>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-[18px] bg-[#fff] p-4 shadow-[var(--shadow-card)]">
              <div className="text-[11.5px] font-semibold text-fg">What this means</div>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-2">
                This address received money from a flagged wallet and spread it quickly across new ones — a common pattern in investment scams. Don&apos;t
                send funds. Report it at cybercrime.gov.in or call 1930.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
