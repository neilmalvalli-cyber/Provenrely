import type { CSSProperties } from "react";
import "./starfield.css";

/**
 * Sparse points of light that fade in, glint and disappear on long, uneven
 * cycles, so only a few are visible at any moment. Pure CSS, deterministic
 * (SSR-safe), fixed behind the page content.
 */
const STARS = Array.from({ length: 42 }, (_, i) => {
  // cheap deterministic hash so positions don't cluster on a grid
  const r = (n: number) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const big = r(3) > 0.86;
  return {
    left: `${(r(1) * 100).toFixed(2)}%`,
    top: `${(r(2) * 100).toFixed(2)}%`,
    size: big ? 2.2 : r(4) > 0.5 ? 1.5 : 1.1,
    peak: (big ? 0.95 : 0.45 + r(5) * 0.4).toFixed(2),
    dur: `${(6 + r(6) * 9).toFixed(1)}s`,
    delay: `${(-r(7) * 15).toFixed(1)}s`,
    tint: r(8) > 0.55 ? "#c9c2ff" : "#e8ecff",
    flare: big,
  };
});

export function Starfield() {
  return (
    <div aria-hidden className="starfield pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {STARS.map((s, i) => (
        <span
          key={i}
          className={s.flare ? "star star-flare" : "star"}
          style={
            {
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              background: s.tint,
              "--peak": s.peak,
              "--glow": s.tint,
              animationDuration: s.dur,
              animationDelay: s.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
