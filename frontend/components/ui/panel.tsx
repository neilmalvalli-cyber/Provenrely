import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Base surface. `glow` is reserved for verified / sealed states — it is the
 * only place a coloured edge appears.
 */
export function GlassPanel({
  className,
  glow = false,
  ...props
}: ComponentProps<"div"> & { glow?: boolean }) {
  return (
    <div
      className={cn(
        "glass relative rounded-2xl shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-32px_rgba(0,0,0,0.9)]",
        glow &&
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:p-px before:[background:linear-gradient(160deg,rgba(167,139,250,0.5),rgba(167,139,250,0.06)_35%,transparent_60%)] before:[mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)]",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  action,
  description,
  className,
}: {
  title: ReactNode;
  /** @deprecated eyebrow labels were removed from panels to reduce noise. */
  label?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-5 pb-1 pt-5 sm:px-6 sm:pt-6", className)}>
      <div className="min-w-0">
        <h3 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
        {description && <p className="mt-0.5 truncate text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <div className="mb-4 text-[14px] font-medium text-violet-300/90">{eyebrow}</div>}
      <h2 className="text-headline text-balance text-fg">{title}</h2>
      {description && <p className="text-lede mt-5 text-pretty text-fg-2">{description}</p>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 px-1 pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="sr-only">{eyebrow}</div>}
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DataField({
  label,
  children,
  mono = false,
  className,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 text-[12.5px] text-muted">{label}</div>
      <div className={cn("truncate text-[14px] text-fg", mono && "font-mono text-[13.5px] tabular-nums")}>{children}</div>
    </div>
  );
}
