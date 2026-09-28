import { cn } from "@/lib/utils";

/** Quiet background: one soft light source and a whisper of noise. */
export function Backdrop({ variant = "page", className }: { variant?: "page" | "hero" | "console"; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {variant === "hero" && (
        <div className="absolute left-1/2 top-[-18%] h-[760px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(109,74,232,0.22),transparent)]" />
      )}
      {variant === "page" && (
        <div className="absolute left-1/2 top-[-30%] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(109,74,232,0.12),transparent)]" />
      )}
      {variant === "console" && (
        <div className="absolute right-[-10%] top-[-25%] h-[520px] w-[760px] rounded-full bg-[radial-gradient(closest-side,rgba(109,74,232,0.08),transparent)]" />
      )}
      <div className="absolute inset-0 noise opacity-[0.03] mix-blend-overlay" />
    </div>
  );
}
