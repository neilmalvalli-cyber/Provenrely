import { cn } from "@/lib/utils";

/**
 * Visual fingerprint of a hash: every nibble sets the length of one radial
 * tick. Two different hashes never look alike, and it reads as an instrument
 * rather than decoration.
 */
export function HashRing({
  hash,
  size = 104,
  tone = "dark",
  className,
}: {
  hash: string;
  size?: number;
  tone?: "dark" | "light";
  className?: string;
}) {
  const hex = hash.replace(/^0x/, "").padEnd(64, "0").slice(0, 64);
  const c = size / 2;
  const outer = size / 2 - 2;
  const inner = outer * 0.58;
  const base = tone === "light" ? "#0c0e14" : "#f5f6f8";
  const accent = tone === "light" ? "#5b3fd9" : "#a78bfa";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("shrink-0", className)} role="img" aria-label="Hash fingerprint">
      <circle cx={c} cy={c} r={outer} fill="none" stroke={base} strokeOpacity="0.08" />
      <circle cx={c} cy={c} r={inner - 3} fill="none" stroke={base} strokeOpacity="0.08" />
      {[...hex].map((ch, i) => {
        const v = parseInt(ch, 16);
        const a = (i / 64) * Math.PI * 2 - Math.PI / 2;
        const len = (outer - inner) * (0.25 + (v / 15) * 0.75);
        const r1 = inner;
        const r2 = inner + len;
        const x1 = (c + Math.cos(a) * r1).toFixed(2);
        const y1 = (c + Math.sin(a) * r1).toFixed(2);
        const x2 = (c + Math.cos(a) * r2).toFixed(2);
        const y2 = (c + Math.sin(a) * r2).toFixed(2);
        const hot = v >= 14;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={hot ? accent : base}
            strokeOpacity={hot ? 0.95 : 0.22 + (v / 15) * 0.4}
            strokeWidth={size > 80 ? 1.4 : 1.1}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={c} cy={c} r={2} fill={accent} />
    </svg>
  );
}
