"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { Check, FileText, Layers, Paperclip, Waypoints } from "lucide-react";
import { useRef, useState } from "react";
import { DecodeText } from "@/components/ui/decode-text";
import { DUR, EASE } from "@/lib/motion";
import { cn, mockHash, shortHash } from "@/lib/utils";
import { STAGES } from "./sealing-stages";

const ITEMS = [
  { icon: Waypoints, label: "Transaction traces", meta: "312 tx · 48 addresses" },
  { icon: Layers, label: "Chain snapshot", meta: "block #6,892,104" },
  { icon: FileText, label: "Investigator findings", meta: "3 indicators" },
  { icon: Paperclip, label: "Attachments", meta: "2 files" },
];

const LEAVES = ITEMS.map((it, i) => mockHash(`leaf-${i}-${it.label}`));
const ROOT = mockHash("merkle-PR-8842");

/* ---------- stage visuals ---------- */

function Collect() {
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-3">
      {ITEMS.map((it, i) => (
        <motion.div
          key={it.label}
          initial={{ opacity: 0, y: 14, rotate: i % 2 ? 1.5 : -1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: DUR.slow, delay: i * 0.07, ease: EASE }}
          className="glass rounded-xl p-4"
        >
          <it.icon className="size-4 text-fg-2" />
          <div className="mt-6 text-[13px] text-fg">{it.label}</div>
          <div className="mt-0.5 font-mono text-[11px] text-muted">{it.meta}</div>
        </motion.div>
      ))}
    </div>
  );
}

function HashStage() {
  return (
    <div className="w-full max-w-md space-y-2.5">
      {ITEMS.map((it, i) => (
        <motion.div
          key={it.label}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: DUR.slow, delay: i * 0.08, ease: EASE }}
          className="flex items-center gap-3"
        >
          <div className="glass flex w-40 shrink-0 items-center gap-2 rounded-lg px-3 py-2.5">
            <it.icon className="size-3.5 text-muted" />
            <span className="truncate text-[12px] text-fg-2">{it.label}</span>
          </div>
          <motion.span
            className="h-px flex-1 origin-left bg-gradient-to-r from-line-strong to-violet/60"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: DUR.slow, delay: 0.2 + i * 0.08, ease: EASE }}
          />
          <code className="w-[124px] shrink-0 font-mono text-[11.5px] text-violet-200">
            <DecodeText text={shortHash(LEAVES[i], 6, 5)} duration={600 + i * 120} />
          </code>
        </motion.div>
      ))}
      <div className="pt-3 text-right font-mono text-[10.5px] text-muted">SHA-256</div>
    </div>
  );
}

function CommitStage() {
  // leaves (y=250) → pair nodes (y=150) → root (y=50)
  const leaves = [60, 170, 280, 390];
  const pairs = [115, 335];
  const path = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
  const draw = (delay: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.6, delay, ease: EASE },
  });
  return (
    <svg viewBox="0 0 450 300" className="w-full max-w-md" role="img" aria-label="Merkle tree">
      {leaves.map((x, i) => (
        <motion.path key={`l${i}`} d={path(x, 250, pairs[i >> 1], 150)} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" {...draw(0.1 + i * 0.05)} />
      ))}
      {pairs.map((x, i) => (
        <motion.path key={`p${i}`} d={path(x, 150, 225, 50)} fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth="1.4" {...draw(0.5 + i * 0.08)} />
      ))}
      {leaves.map((x, i) => (
        <motion.g key={`ln${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.base, delay: i * 0.05 }}>
          <rect x={x - 44} y={238} width="88" height="24" rx="6" fill="#0e1118" stroke="rgba(255,255,255,0.1)" />
          <text x={x} y={254} textAnchor="middle" fill="#a4a9b4" fontSize="10" fontFamily="var(--font-mono)">
            {shortHash(LEAVES[i], 4, 3)}
          </text>
        </motion.g>
      ))}
      {pairs.map((x, i) => (
        <motion.g key={`pn${i}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: DUR.base, delay: 0.4 + i * 0.08 }} style={{ transformOrigin: `${x}px 150px` }}>
          <rect x={x - 44} y={138} width="88" height="24" rx="6" fill="#0e1118" stroke="rgba(167,139,250,0.35)" />
          <text x={x} y={154} textAnchor="middle" fill="#c4b5fd" fontSize="10" fontFamily="var(--font-mono)">
            {shortHash(mockHash(`pair-${i}`), 4, 3)}
          </text>
        </motion.g>
      ))}
      <motion.g initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: DUR.slow, delay: 0.85, ease: EASE }} style={{ transformOrigin: "225px 50px" }}>
        <rect x={150} y={32} width="150" height="36" rx="9" fill="rgba(124,92,250,0.16)" stroke="rgba(196,181,253,0.8)" />
        <text x={225} y={47} textAnchor="middle" fill="#ddd6fe" fontSize="9" letterSpacing="0.08em">
          MERKLE ROOT
        </text>
        <text x={225} y={60} textAnchor="middle" fill="#f5f6f8" fontSize="10.5" fontFamily="var(--font-mono)">
          {shortHash(ROOT, 6, 5)}
        </text>
      </motion.g>
    </svg>
  );
}

function AnchorStage() {
  const blocks = [6892116, 6892117, 6892118, 6892119, 6892120];
  return (
    <div className="w-full max-w-md">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.slow, ease: EASE }}
        className="mx-auto mb-6 w-fit rounded-lg border border-violet/40 bg-violet/10 px-3 py-2 font-mono text-[11.5px] text-violet-100"
      >
        root {shortHash(ROOT, 6, 5)}
      </motion.div>
      <motion.div
        className="mx-auto mb-2 h-8 w-px bg-gradient-to-b from-violet/70 to-transparent"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: DUR.slow, delay: 0.25, ease: EASE }}
        style={{ originY: 0 }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
        {blocks.map((b, i) => {
          const hit = i === 2;
          return (
            <motion.div
              key={b}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: hit ? 1 : 0.55, y: 0 }}
              transition={{ duration: DUR.base, delay: 0.1 + i * 0.05 }}
              className={cn(
                "relative flex size-[68px] flex-col items-center justify-center rounded-xl border bg-panel text-center",
                hit ? "border-violet/60 shadow-[0_0_32px_-6px_rgba(139,108,248,0.7)]" : "border-line-strong",
              )}
            >
              {hit && (
                <motion.span
                  className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-ok text-void"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.75, duration: DUR.base, ease: EASE }}
                >
                  <Check className="size-3" strokeWidth={3} />
                </motion.span>
              )}
              <span className="font-mono text-[9.5px] text-muted">#{String(b).slice(-3)}</span>
              {hit && <span className="mt-1 text-[10px] text-violet-200">root</span>}
            </motion.div>
          );
        })}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: DUR.slow }}
        className="mt-6 text-center font-mono text-[11px] text-muted"
      >
        anchored at block #6,892,118 · finalized
      </motion.p>
    </div>
  );
}

const VISUALS = [Collect, HashStage, CommitStage, AnchorStage];

/* ---------- section ---------- */

export function SealingStory() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const [stage, setStage] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setStage(Math.min(STAGES.length - 1, Math.max(0, Math.floor(v * STAGES.length * 0.999))));
  });

  const Visual = VISUALS[stage];

  return (
    <>
      {/* Desktop: pinned, scroll-driven */}
      <div ref={ref} className="relative hidden h-[250vh] lg:block">
        <div className="sticky top-0 flex h-screen items-center">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-16 px-8">
            <div>
              <div className="mb-4 text-[13px] font-medium text-violet-300/90">How sealing works</div>
              <h2 className="text-headline text-balance text-fg">From findings to a proof anyone can check.</h2>
              <ol className="relative mt-12 space-y-1 pl-6">
                <span className="absolute bottom-2 left-0 top-2 w-px bg-line-strong" />
                <motion.span className="absolute left-0 top-2 w-px origin-top bg-violet" style={{ scaleY: progress, bottom: 8 }} />
                {STAGES.map((s, i) => {
                  const active = i === stage;
                  const Icon = s.icon;
                  return (
                    <li key={s.key} className="relative py-3">
                      <span
                        className={cn(
                          "absolute -left-[27px] top-[18px] size-[7px] rounded-full border transition-colors duration-300",
                          i <= stage ? "border-violet bg-violet" : "border-line-strong bg-void",
                        )}
                      />
                      <div className={cn("flex items-center gap-3 transition-colors duration-300", active ? "text-fg" : "text-muted")}>
                        <Icon className="size-[18px]" />
                        <span className="text-[17px] font-medium tracking-[-0.01em]">{s.title}</span>
                      </div>
                      <motion.p
                        initial={false}
                        animate={{ height: active ? "auto" : 0, opacity: active ? 1 : 0 }}
                        transition={{ duration: DUR.base, ease: EASE }}
                        className="overflow-hidden pl-[30px] text-[14.5px] leading-relaxed text-fg-2"
                      >
                        <span className="block pt-2">{s.body}</span>
                      </motion.p>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="relative flex aspect-[5/4] items-center justify-center rounded-3xl border border-line bg-gradient-to-b from-panel/70 to-void/40 p-10">
              <div className="absolute left-5 top-4 font-mono text-[11px] text-muted">
                {String(stage + 1).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={stage}
                  className="relative flex w-full justify-center"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: DUR.base, ease: EASE }}
                >
                  <Visual />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile / tablet: stacked */}
      <div className="px-4 py-24 sm:px-6 lg:hidden">
        <div className="mb-4 text-[13px] font-medium text-violet-300/90">How sealing works</div>
        <h2 className="text-headline text-balance text-fg">From findings to a proof anyone can check.</h2>
        <div className="mt-12 space-y-14">
          {STAGES.map((s, i) => {
            const V = VISUALS[i];
            return (
              <MobileStage key={s.key} index={i} title={s.title} body={s.body} icon={s.icon}>
                <V />
              </MobileStage>
            );
          })}
        </div>
      </div>
    </>
  );
}

function MobileStage({
  index,
  title,
  body,
  icon: Icon,
  children,
}: {
  index: number;
  title: string;
  body: string;
  icon: (typeof STAGES)[number]["icon"];
  children: React.ReactNode;
}) {
  const [seen, setSeen] = useState(false);
  return (
    <motion.div onViewportEnter={() => setSeen(true)} viewport={{ once: true, margin: "-80px" }}>
      <div className="flex items-center gap-3 text-fg">
        <span className="font-mono text-[11px] text-muted">{String(index + 1).padStart(2, "0")}</span>
        <Icon className="size-[18px]" />
        <span className="text-[17px] font-medium">{title}</span>
      </div>
      <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">{body}</p>
      <div className="mt-6 flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-panel/50 p-5">
        {seen && children}
      </div>
    </motion.div>
  );
}
