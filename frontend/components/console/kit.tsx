import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Console UI kit: monochrome bento on frosted glass. Tokens live in console-theme.css (scoped to the console),
 * so these components are only meant to be used inside the AppShell.
 */

/** The large frosted-glass surface floating over the marble. */
export function GlassShell({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("glass-shell", className)} {...props} />;
}

type CardProps = ComponentProps<"section"> & { variant?: "light" | "dark"; padded?: boolean };

/** Bento card. `dark` is the near-black feature card; anything inside it switches to light-on-dark tokens. */
export function Card({ variant = "light", padded = false, className, ...props }: CardProps) {
  return (
    <section
      className={cn(
        "relative min-w-0 rounded-[var(--radius-card)]",
        variant === "light"
          ? "border border-black/[0.05] bg-[#fff] text-fg shadow-[var(--shadow-card)]"
          : "console-dark bg-[#0b0b0c] text-fg shadow-[0_18px_40px_-20px_rgba(11,11,12,0.6)]",
        padded && "p-5 sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

/** Card title row: bold title, optional grey subtitle, optional action on the right. */
export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6", className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Small grey caps label (sidebar sections, tile captions). */
export function Eyebrow({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-[11px] font-semibold uppercase tracking-[0.08em] text-muted", className)} {...props} />;
}

/** A number with its label: large bold figure, small grey caption. "—" when unavailable. */
export function StatTile({
  label,
  value,
  hint,
  size = "md",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[12.5px] text-muted">{label}</div>
      <div
        className={cn(
          "mt-1 font-semibold tabular-nums tracking-[-0.03em] text-fg",
          size === "lg" ? "text-[44px] leading-[1.05] sm:text-[52px]" : "text-[28px] leading-tight",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

/** Inner tile of a card (16px radius). */
export function Tile({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[var(--radius-tile)] bg-panel-2 p-4", className)} {...props} />;
}

const pill = {
  base: "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[13.5px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  primary: "bg-[#0b0b0c] text-[#fff] hover:bg-[#26272b]",
  secondary: "border border-black/[0.12] bg-[#fff] text-[#0b0b0c] hover:bg-[#f4f4f5]",
} as const;

type PillVariant = "primary" | "secondary";

/** Fully rounded button: black primary, white-with-border secondary. */
export function PillButton({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: PillVariant }) {
  return <button className={cn(pill.base, pill[variant], className)} {...props} />;
}

export function PillLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: PillVariant }) {
  return <Link className={cn(pill.base, pill[variant], className)} {...props} />;
}

/** Circular icon button (search, notifications…). Always give it an aria-label. */
export function IconButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-[#fff] text-[#0b0b0c] transition-colors hover:bg-[#f4f4f5] [&_svg]:size-[18px]",
        className,
      )}
      {...props}
    />
  );
}

type Tone = "neutral" | "ok" | "warn" | "danger";
const TONE_DOT: Record<Tone, string> = { neutral: "bg-muted", ok: "bg-ok", warn: "bg-warn", danger: "bg-danger" };

/** Thin status badge: a coloured dot and a word. Colour only where the meaning needs it. */
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong px-2.5 text-[12px] font-medium text-fg-2",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
      {children}
    </span>
  );
}

/** Ring showing a share (0–1). `null` draws an empty track and shows "—". */
export function ProgressRing({ value, size = 132, stroke = 12, label }: { value: number | null; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.min(1, Math.max(0, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={stroke} />
        {value !== null && v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[26px] font-semibold tabular-nums tracking-[-0.03em] text-fg">{value === null ? "—" : `${Math.round(v * 100)}%`}</div>
          {label && <div className="text-[11.5px] text-muted">{label}</div>}
        </div>
      </div>
    </div>
  );
}

/** Thin horizontal bar (0–1). `null` shows an empty track. */
export function ProgressBar({ value, className }: { value: number | null; className?: string }) {
  const v = value === null ? 0 : Math.min(1, Math.max(0, value));
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-fg/10", className)} role="presentation">
      <div className="h-full rounded-full bg-fg transition-[width] duration-700" style={{ width: `${v * 100}%` }} />
    </div>
  );
}
