"use client";

import { useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const GLYPHS = "0123456789abcdef";

/**
 * Reveals text left-to-right, each character resolving out of random hex.
 * Used for hashes at the moment they are produced or verified.
 */
export function DecodeText({ text, duration = 700, className }: { text: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (!inView || reduce) {
      setOut(text);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const settled = Math.floor(p * text.length);
      let s = text.slice(0, settled);
      for (let i = settled; i < text.length; i++) {
        const ch = text[i];
        s += /[0-9a-f]/i.test(ch) ? GLYPHS[(Math.random() * 16) | 0] : ch;
      }
      setOut(s);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, text, duration, reduce]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      {out}
    </span>
  );
}
