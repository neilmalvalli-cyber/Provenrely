"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { NODE_META } from "@/data/graph";
import type { GraphEdge, GraphNode } from "@/data/types";
import { EASE } from "@/lib/motion";
import { cn, shortHash } from "@/lib/utils";

const W = 1000;
const H = 600;
const FULL = { x: 0, y: 0, w: W, h: H };
type View = typeof FULL;

function curve(a: GraphNode, b: GraphNode) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return `M${a.x},${a.y} Q${mx - dy * 0.12},${my + dx * 0.12} ${b.x},${b.y}`;
}

export function NetworkGraph({
  nodes,
  edges,
  selectedId,
  onSelect,
  visible,
  compact = false,
  interactive = false,
  className,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Node ids to show; omitted = all. */
  visible?: Set<string>;
  compact?: boolean;
  /** Enables drag-to-pan, wheel zoom, zoom buttons and minimap. */
  interactive?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(svgRef, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [view, setView] = useState<View>(FULL);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);

  const shown = useCallback((id: string) => !visible || visible.has(id), [visible]);
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const vEdges = edges.filter((e) => shown(e.from) && shown(e.to));
  const vNodes = nodes.filter((n) => shown(n.id));
  const maxValue = Math.max(1, ...edges.map((e) => e.valueEth));

  const linked = useMemo(() => {
    if (!selectedId || byId[selectedId]?.kind === "target") return null;
    const s = new Set<string>([selectedId]);
    edges.forEach((e) => {
      if (e.from === selectedId) s.add(e.to);
      if (e.to === selectedId) s.add(e.from);
    });
    return s;
  }, [edges, selectedId, byId]);

  /* ---- pan & zoom ---- */
  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const w = Math.min(W * 1.2, Math.max(W / 5, v.w * factor));
      const h = (w / W) * H;
      const px = cx ?? v.x + v.w / 2;
      const py = cy ?? v.y + v.h / 2;
      const rx = (px - v.x) / v.w;
      const ry = (py - v.y) / v.h;
      return { x: px - rx * w, y: py - ry * h, w, h };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((v) => {
        const px = v.x + ((e.clientX - r.left) / r.width) * v.w;
        const py = v.y + ((e.clientY - r.top) / r.height) * v.h;
        const factor = Math.exp(e.deltaY * 0.0015);
        const w = Math.min(W * 1.2, Math.max(W / 5, v.w * factor));
        const h = (w / W) * H;
        const rx = (px - v.x) / v.w;
        const ry = (py - v.y) / v.h;
        return { x: px - rx * w, y: py - ry * h, w, h };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive]);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive) return;
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false };
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - d.x) / r.width) * d.view.w;
    const dy = ((e.clientY - d.y) / r.height) * d.view.h;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) {
      if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
      d.moved = true;
    }
    if (d.moved) setView({ ...d.view, x: d.view.x - dx, y: d.view.y - dy });
  }
  function onPointerUp() {
    drag.current = null;
  }

  const zoomed = Math.abs(view.w - W) > 1 || Math.abs(view.x) > 1 || Math.abs(view.y) > 1;
  const animateIn = !reduce; // start from the settle position unless reduced motion
  const play = inView || !!reduce;
  // After the entrance finishes, flows that appear later (on selection) fade in immediately.
  const entered = useRef(false);
  useEffect(() => {
    if (!play) return;
    const t = setTimeout(() => (entered.current = true), 2000);
    return () => clearTimeout(t);
  }, [play]);

  return (
    <div className={cn("relative", className)}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className={cn("h-auto w-full", interactive && (drag.current?.moved ? "cursor-grabbing" : "cursor-grab"))}
        role="img"
        aria-label="Transaction graph"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <radialGradient id={`bg-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#6d4ae8" stopOpacity="0.14" />
            <stop offset="1" stopColor="#6d4ae8" stopOpacity="0" />
          </radialGradient>
          <filter id={`glow-${uid}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <circle cx="500" cy="300" r="320" fill={`url(#bg-${uid})`} />
        {[150, 260].map((r) => (
          <ellipse key={r} cx="500" cy="300" rx={r * 1.45} ry={r} fill="none" stroke="rgba(255,255,255,0.045)" strokeDasharray="2 7" />
        ))}

        {vEdges.map((e, i) => {
          const a = byId[e.from];
          const b = byId[e.to];
          const active = linked ? linked.has(e.from) && linked.has(e.to) : false;
          const dim = linked && !active;
          const color = NODE_META[b.kind].color;
          const w = 0.8 + (e.valueEth / maxValue) * 2.2;
          return (
            <g key={`${e.from}-${e.to}`} opacity={dim ? 0.12 : 1} className="transition-opacity duration-300">
              <motion.path
                d={curve(a, b)}
                fill="none"
                stroke={color}
                strokeOpacity={e.hop === 1 ? 0.42 : 0.24}
                strokeWidth={w}
                initial={animateIn ? { pathLength: 0 } : false}
                animate={play ? { pathLength: 1 } : undefined}
                transition={{ duration: 0.7, ease: EASE, delay: 0.35 + e.hop * 0.18 + (i % 6) * 0.02 }}
              />
              {(active || (!linked && e.hop === 1)) && (
                <motion.path
                  d={curve(a, b)}
                  fill="none"
                  stroke={color}
                  strokeWidth={Math.max(1.1, w * 0.6)}
                  // Pattern length (12) must divide the keyframe offset (24, see
                  // @keyframes dash) or the loop visibly jumps each cycle.
                  strokeDasharray="2 10"
                  strokeLinecap="round"
                  className="animate-dash"
                  style={{ animationDuration: `${1.4 + (i % 4) * 0.3}s` }}
                  // Only start the flow once the edge beneath it has drawn in.
                  initial={animateIn ? { opacity: 0 } : false}
                  animate={play ? { opacity: 1 } : undefined}
                  transition={{ duration: 0.4, delay: entered.current ? 0 : 1.05 + e.hop * 0.18 + (i % 6) * 0.02 }}
                />
              )}
            </g>
          );
        })}

        {vNodes.map((n) => {
          const meta = NODE_META[n.kind];
          const isTarget = n.kind === "target";
          const r = isTarget ? 20 : n.id.startsWith("h1") ? 11 : 7.5;
          const selected = selectedId === n.id;
          const dim = linked && !linked.has(n.id);
          const hop = isTarget ? 0 : n.id.startsWith("h1") ? 1 : 2;
          return (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
              <motion.g
                initial={animateIn ? { x: 500 - n.x, y: 300 - n.y, opacity: 0, scale: 0.4 } : false}
                animate={play ? { x: 0, y: 0, opacity: dim ? 0.22 : 1, scale: 1 } : undefined}
                transition={{
                  x: { type: "spring", stiffness: 70, damping: 13, delay: hop * 0.12 },
                  y: { type: "spring", stiffness: 70, damping: 13, delay: hop * 0.12 },
                  scale: { duration: 0.5, delay: hop * 0.12 },
                  opacity: { duration: 0.3 },
                }}
                className={cn("outline-none", onSelect && "cursor-pointer")}
                onClick={
                  onSelect
                    ? (ev) => {
                        ev.stopPropagation();
                        onSelect(n.id);
                      }
                    : undefined
                }
                onPointerDown={(ev) => onSelect && ev.stopPropagation()}
                onKeyDown={onSelect ? (ev) => (ev.key === "Enter" || ev.key === " ") && onSelect(n.id) : undefined}
                tabIndex={onSelect ? 0 : undefined}
                role={onSelect ? "button" : undefined}
                aria-label={onSelect ? `${meta.name} ${shortHash(n.address)}` : undefined}
              >
                {(isTarget || selected) && <circle r={r + 8} fill={meta.color} opacity="0.3" filter={`url(#glow-${uid})`} />}
                <circle r={r + 5} fill="none" stroke={meta.color} strokeOpacity={selected ? 0.9 : 0.22} strokeWidth="1" />
                <circle r={r} fill="#0b0d14" stroke={meta.color} strokeWidth={isTarget ? 1.8 : 1.4} />
                <circle r={r * 0.4} fill={meta.color} opacity={isTarget ? 1 : 0.85} />
                {!compact && (isTarget || n.id.startsWith("h1") || selected) && (
                  <g transform={`translate(0 ${r + 19})`} className="pointer-events-none">
                    <text textAnchor="middle" fill="#f5f6f8" fontSize="12" style={{ fontFamily: "var(--font-sans)" }}>
                      {n.label}
                    </text>
                    <text y="15" textAnchor="middle" fill="#8a91a0" fontSize="10.5" style={{ fontFamily: "var(--font-mono)" }}>
                      {shortHash(n.address, 6, 4)}
                    </text>
                  </g>
                )}
              </motion.g>
            </g>
          );
        })}
      </svg>

      {interactive && (
        <>
          <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border border-line-strong bg-panel/90 backdrop-blur">
            <button onClick={() => zoomAt(0.8)} className="grid size-8 place-items-center text-fg-2 hover:bg-white/5 hover:text-fg" aria-label="Zoom in">
              <Plus className="size-3.5" />
            </button>
            <button onClick={() => zoomAt(1.25)} className="grid size-8 place-items-center border-t border-line text-fg-2 hover:bg-white/5 hover:text-fg" aria-label="Zoom out">
              <Minus className="size-3.5" />
            </button>
            <button onClick={() => setView(FULL)} disabled={!zoomed} className="grid size-8 place-items-center border-t border-line text-fg-2 hover:bg-white/5 hover:text-fg disabled:opacity-30" aria-label="Fit to view">
              <Maximize2 className="size-3.5" />
            </button>
          </div>

          <Minimap nodes={vNodes} view={view} onJump={(x, y) => setView((v) => ({ ...v, x: x - v.w / 2, y: y - v.h / 2 }))} />
        </>
      )}
    </div>
  );
}

function Minimap({ nodes, view, onJump }: { nodes: GraphNode[]; view: View; onJump: (x: number, y: number) => void }) {
  const zoomed = view.w < W - 1 || Math.abs(view.x) > 1 || Math.abs(view.y) > 1;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn(
        "absolute bottom-3 right-3 hidden w-40 cursor-pointer rounded-lg border border-line-strong bg-panel/90 backdrop-blur transition-opacity duration-300 sm:block",
        zoomed ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onJump(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
      }}
      aria-label="Minimap"
    >
      {nodes.map((n) => (
        <circle key={n.id} cx={n.x} cy={n.y} r={n.kind === "target" ? 16 : 10} fill={NODE_META[n.kind].color} opacity="0.8" />
      ))}
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="rgba(139,108,248,0.08)" stroke="#a78bfa" strokeWidth="8" rx="10" />
    </svg>
  );
}

export function GraphLegend({
  className,
  hidden,
  onToggle,
}: {
  className?: string;
  hidden?: Set<string>;
  onToggle?: (kind: string) => void;
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-1 gap-y-1", className)}>
      {Object.entries(NODE_META).map(([k, m]) => {
        const off = hidden?.has(k);
        const Tag = onToggle && k !== "target" ? "button" : "span";
        return (
          <Tag
            key={k}
            {...(Tag === "button" ? { onClick: () => onToggle!(k), "aria-pressed": !off } : {})}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition-colors",
              off ? "text-muted/60 line-through" : "text-fg-2",
              Tag === "button" && "hover:bg-white/[0.04]",
            )}
          >
            <span className="size-2 rounded-full transition-opacity" style={{ background: m.color, opacity: off ? 0.3 : 1 }} />
            {m.name}
          </Tag>
        );
      })}
    </div>
  );
}
