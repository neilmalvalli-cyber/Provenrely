"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DecodeText } from "@/components/ui/decode-text";
import { getCase } from "@/data/cases";
import { DUR, EASE } from "@/lib/motion";
import { cn, formatNumber, shortHash, sleep } from "@/lib/utils";

const STEPS = ["Recompute SHA-256", "Read certificates(hash)", "Check the anchor"];

/** In-page verification demo with an example certificate hash (no chain call; the console does the real check on MST). */
export function VerifyDemo() {
  const c = getCase("PR-8842")!;
  const genuine = c.evidence.proofHash;
  const [hash, setHash] = useState(genuine);
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<null | boolean>(null);
  const running = step >= 0 && result === null;
  const tampered = hash !== genuine;

  async function run() {
    setResult(null);
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await sleep(520);
    }
    setStep(STEPS.length);
    setResult(hash.toLowerCase() === genuine.toLowerCase());
  }

  function tamper() {
    // flip one character near the middle
    const i = 30;
    const ch = hash[i] === "a" ? "b" : "a";
    setHash(hash.slice(0, i) + ch + hash.slice(i + 1));
    setStep(-1);
    setResult(null);
  }

  function reset() {
    setHash(genuine);
    setStep(-1);
    setResult(null);
  }

  return (
    <div className="glass overflow-hidden rounded-3xl">
      <div className="border-b border-line p-5 sm:p-7">
        <label htmlFor="demo-hash" className="text-[12px] text-muted">
          Certificate hash · example
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex min-w-0 flex-1 items-center rounded-full border border-line-strong bg-panel-2 px-4">
            <input
              id="demo-hash"
              value={hash}
              onChange={(e) => {
                setHash(e.target.value.trim());
                setStep(-1);
                setResult(null);
              }}
              spellCheck={false}
              className="h-12 w-full min-w-0 bg-transparent font-mono text-[12.5px] text-fg outline-none"
            />
            {tampered && <span className="ml-2 shrink-0 rounded bg-warn/15 px-1.5 py-0.5 text-[10.5px] text-amber-200">edited</span>}
          </div>
          <Button variant="primary" size="lg" onClick={run} disabled={running} className="sm:w-36">
            {running ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Verify
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={tamper} disabled={running}>
            Change one character
          </Button>
          {tampered && (
            <Button variant="ghost" size="sm" onClick={reset} disabled={running}>
              <RotateCcw />
              Restore original
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[220px_1fr]">
        <ol className="space-y-3">
          {STEPS.map((s, i) => {
            const done = step > i;
            const active = step === i;
            return (
              <li key={s} className={cn("flex items-center gap-3 text-[13px] transition-colors", done || active ? "text-fg" : "text-muted")}>
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border transition-colors",
                    done ? "border-violet/50 bg-violet/15 text-violet-200" : active ? "border-violet/60" : "border-line-strong",
                  )}
                >
                  {done ? <CheckCircle2 className="size-3" /> : active ? <Loader2 className="size-3 animate-spin text-violet-300" /> : null}
                </span>
                {s}
              </li>
            );
          })}
        </ol>

        <div className="min-h-[120px]">
          <AnimatePresence mode="wait">
            {result === null ? (
              <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[14px] leading-relaxed text-fg-2">
                {running
                  ? "Looking up this exact hash in the registry…"
                  : "Press Verify to check this hash against its anchor. Then change one character and try again."}
              </motion.p>
            ) : result ? (
              <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: DUR.base, ease: EASE }}>
                <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-5">
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <div className="flex items-center gap-2.5 text-emerald-200">
                    <CheckCircle2 className="size-5" />
                    <span className="text-[15px] font-medium">Verified</span>
                  </div>
                  <p className="mt-2 text-[13px] text-fg-2">
                    This exact hash <code className="font-mono text-fg"><DecodeText text={shortHash(hash, 8, 6)} /></code> was anchored on MST at block{" "}
                    <span className="font-mono text-fg">#{formatNumber(c.evidence.blockHeight)}</span> (example).
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="bad" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: DUR.base, ease: EASE }}>
                <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5">
                  <div className="flex items-center gap-2.5 text-red-200">
                    <XCircle className="size-5" />
                    <span className="text-[15px] font-medium">Tampered — never anchored</span>
                  </div>
                  <p className="mt-2 text-[13px] text-fg-2">
                    One changed character produces a completely different hash, so the registry has no record of it: this copy isn't the certificate that was issued.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
