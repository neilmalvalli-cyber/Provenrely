"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * From the `lg` breakpoint up, lays its child out at a fixed design width and scales it
 * down to the column, so a wide component keeps its desktop layout in a narrow side column.
 * Below `lg` (single column) the child is left to its own responsive layout. Never scales up.
 */
export function FitWidth({ width, children, className }: { width: number; children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ k: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      if (!mq.matches) return setFit(null);
      const k = Math.min(1, o.clientWidth / width);
      setFit({ k, h: i.offsetHeight * k });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    mq.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", measure);
    };
  }, [width]);

  return (
    // the unscaled layout box is wider than the column: clip it sideways so the page never scrolls horizontally
    <div ref={outer} className={className} style={fit ? { height: fit.h, overflowX: "clip", overflowClipMargin: 48 } : undefined}>
      <div ref={inner} style={fit ? { width, transform: `scale(${fit.k})`, transformOrigin: "0 0" } : undefined}>
        {children}
      </div>
    </div>
  );
}
