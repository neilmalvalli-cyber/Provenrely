"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Runs through a list of steps on a timer, then calls onDone.
 * `render` can attach an output line (e.g. a hash) to finished steps.
 */
export function ProgressSteps({
  steps,
  stepMs = 900,
  onDone,
  render,
}: {
  steps: readonly { key: string; label: string; detail: string }[];
  stepMs?: number;
  onDone: () => void;
  render?: (key: string) => string | undefined;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (i >= steps.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((x) => x + 1), stepMs + (i % 2) * 250);
    return () => clearTimeout(t);
  }, [i, steps.length, stepMs, onDone]);

  const pct = Math.min(100, (i / steps.length) * 100);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-[13px] text-muted">Progress</span>
        <span className="font-mono text-[13px] tabular-nums text-fg">{Math.round(pct)}%</span>
      </div>
      <div className="relative mb-8 h-1 overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-brand" animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
        {i < steps.length && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="h-full w-1/3 animate-scan bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
        )}
      </div>

      <ol className="space-y-1">
        {steps.map((s, idx) => {
          const done = idx < i;
          const active = idx === i;
          const out = done ? render?.(s.key) : undefined;
          return (
            <li
              key={s.key}
              className={cn(
                "flex items-start gap-3.5 rounded-lg px-3 py-3 transition-colors",
                active && "bg-white/[0.03]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                  done && "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
                  active && "border-violet/60 text-violet-300",
                  !done && !active && "border-line-strong",
                )}
              >
                {done ? <Check className="size-3" /> : active ? <Loader2 className="size-3 animate-spin" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn("text-[14.5px]", done || active ? "text-fg" : "text-muted")}>{s.label}</div>
                <div className="mt-0.5 text-[13px] text-muted">{s.detail}</div>
                {out && (
                  <motion.code
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-1.5 block truncate font-mono text-[12.5px] text-violet-300"
                  >
                    {out}
                  </motion.code>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
