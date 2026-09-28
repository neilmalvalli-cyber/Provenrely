"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { EASE } from "@/lib/motion";
import { riskTone } from "./badges";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function smooth(pts: [number, number][]) {
  return pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, "");
}

/**
 * Area chart drawn at its real pixel width (no stretching), with a
 * crosshair + tooltip that follows the pointer.
 */
export function AreaChart({
  data,
  labels,
  height = 180,
  unit = "",
}: {
  data: number[];
  labels: string[];
  height?: number;
  unit?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padX = 4;
  const padTop = 12;
  const h = height;
  const max = Math.max(1, ...data) * 1.15;
  const x = (i: number) => padX + (i / Math.max(1, data.length - 1)) * (w - padX * 2);
  const y = (v: number) => padTop + (1 - v / max) * (h - padTop - 4);
  const pts = data.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = w ? smooth(pts) : "";
  const area = w ? `${line} L${x(data.length - 1)},${h} L${x(0)},${h} Z` : "";
  const ticks = [0, Math.floor((data.length - 1) / 2), data.length - 1];

  function onMove(e: React.PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - padX) / (r.width - padX * 2)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const hi = hover ?? null;

  return (
    <div>
      <div ref={ref} className="relative touch-none select-none" style={{ height: h }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {w > 0 && (
          <svg width={w} height={h} className="absolute inset-0 overflow-visible" role="img" aria-label="Evidence sealed per day">
            <defs>
              <linearGradient id={`f-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#8b6cf8" stopOpacity="0.22" />
                <stop offset="1" stopColor="#8b6cf8" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={w} y1={padTop + (h - padTop) * f} y2={padTop + (h - padTop) * f} stroke="rgba(255,255,255,0.05)" />
            ))}
            <motion.path key={`a-${data.length}`} d={area} fill={`url(#f-${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
            <motion.path
              key={`l-${data.length}`}
              d={line}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="1.75"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: EASE }}
            />
            {hi !== null ? (
              <g>
                <line x1={pts[hi][0]} x2={pts[hi][0]} y1={padTop - 6} y2={h} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 3" />
                <circle cx={pts[hi][0]} cy={pts[hi][1]} r="4" fill="#0b0d14" stroke="#c4b5fd" strokeWidth="2" />
              </g>
            ) : (
              <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="#c4b5fd" />
            )}
          </svg>
        )}
        {hi !== null && w > 0 && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-lg border border-line-strong bg-panel/95 px-2.5 py-1.5 shadow-xl backdrop-blur"
            style={{ left: Math.min(Math.max(pts[hi][0] - 56, 0), w - 112), width: 112 }}
          >
            <div className="text-[11.5px] text-muted">{labels[hi]}</div>
            <div className="font-mono text-[14px] tabular-nums text-fg">
              {data[hi]}
              {unit && <span className="ml-1 text-[12px] text-muted">{unit}</span>}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11.5px] text-muted">
        {ticks.map((t) => (
          <span key={t}>{labels[t]}</span>
        ))}
      </div>
    </div>
  );
}

/** Semicircular risk gauge; the arc draws in once. */
export function RiskGauge({ score, size = 180 }: { score: number; size?: number }) {
  const t = riskTone(score);
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.62 }}>
      <svg viewBox="0 0 180 112" className="size-full">
        <path d="M20 100 A70 70 0 0 1 160 100" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" strokeLinecap="round" />
        <motion.path
          d="M20 100 A70 70 0 0 1 160 100"
          fill="none"
          stroke={t.color}
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: score / 100 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-mono text-[34px] font-medium leading-none tabular-nums tracking-tight text-fg">{score}</span>
        <span className={`mt-1.5 text-[13px] ${t.text}`}>{t.label} risk</span>
      </div>
    </div>
  );
}

/** Horizontal stacked distribution bar; segments grow in once. */
export function DistributionBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div>
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ width: 0 }}
            animate={{ width: `${(s.value / total) * 100}%` }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.06 }}
            style={{ background: s.color }}
            className="h-full"
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-[13.5px]">
            <span className="flex items-center gap-2 text-fg-2">
              <span className="size-1.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-mono tabular-nums text-fg">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
