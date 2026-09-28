import { PRODUCT_NAME, PRODUCT_WORDMARK } from "@/lib/config/brand";
import { cn } from "@/lib/utils";

/**
 * Brand assets, cut from the supplied logo artwork
 * (regenerate with `node scripts/extract-brand.mjs`).
 * `sm` covers anything up to ~80px tall; `lg` is for hero artwork.
 * `sm` uses mark-160-solid.webp: the same artwork composited onto a deep indigo base (#14123c) inside its own
 * silhouette (alpha > 0.15, holes filled) and fully opaque, so the small logo holds up on white and light backgrounds.
 */
const MARK = {
  sm: { src: "/brand/mark-160-solid.webp", w: 113, h: 160 },
  lg: { src: "/brand/mark-640.webp", w: 451, h: 640 },
};

type MarkProps = {
  className?: string;
  /** Marks this image as the landing intro's hand-off target. */
  introTarget?: string;
  size?: "sm" | "lg";
  /** @deprecated the artwork is used at every size. */
  simplified?: boolean;
  priority?: boolean;
};

export function LogoMark({ className, size = "sm", priority = false, introTarget }: MarkProps) {
  const m = MARK[size];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={m.src}
      width={m.w}
      height={m.h}
      alt={PRODUCT_NAME}
      draggable={false}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      data-intro-target={introTarget}
      className={cn("h-8 w-auto select-none", className)}
    />
  );
}

/** The product name as a text wordmark (the old image wordmark carried the previous name). */
export function Wordmark({ className, introTarget }: { className?: string; introTarget?: string }) {
  return (
    <span
      data-intro-target={introTarget}
      className={cn("select-none whitespace-nowrap text-[15px] font-semibold uppercase leading-none tracking-[0.32em] text-fg", className)}
    >
      {PRODUCT_WORDMARK}
    </span>
  );
}

export function Logo({ className, compact = false, intro = false }: { className?: string; compact?: boolean; intro?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label={PRODUCT_NAME}>
      <LogoMark className={cn("h-10", intro && "intro-fade")} priority />
      {!compact && <Wordmark introTarget={intro ? "nav-wordmark" : undefined} />}
    </span>
  );
}
