import type { SVGProps } from "react";

/**
 * Custom glyphs for the product's core concepts, drawn on the same 24px grid
 * and stroke weight as Lucide so they sit alongside it.
 */
type P = SVGProps<SVGSVGElement>;

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "lucide",
};

/** Seal: a hexagonal block closed by a check. */
export function SealGlyph(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4Z" />
      <path d="m8.6 12.2 2.3 2.3 4.6-4.9" />
    </svg>
  );
}

/** Anchor: a block committed onto a chain line. */
export function AnchorGlyph(props: P) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="3" width="8" height="8" rx="1.6" />
      <path d="M12 11v5" />
      <path d="M3 19h18" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

/** Merkle: leaves converging into a single root. */
export function MerkleGlyph(props: P) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="4.5" r="2" />
      <circle cx="6.5" cy="12" r="1.7" />
      <circle cx="17.5" cy="12" r="1.7" />
      <path d="M12 6.5 6.5 10.3M12 6.5l5.5 3.8" />
      <path d="M6.5 13.7 4 19.5M6.5 13.7 9 19.5M17.5 13.7 15 19.5M17.5 13.7l2.5 5.8" />
    </svg>
  );
}
