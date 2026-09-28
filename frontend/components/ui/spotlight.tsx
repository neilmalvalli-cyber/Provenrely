"use client";

import type { ComponentProps, PointerEvent } from "react";
import { cn } from "@/lib/utils";

/** Card surface with a soft light that follows the pointer along its edge. */
export function SpotlightCard({ className, children, ...props }: ComponentProps<"div">) {
  function move(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }
  return (
    <div
      {...props}
      onPointerMove={move}
      onPointerEnter={(e) => e.currentTarget.style.setProperty("--spot", "1")}
      onPointerLeave={(e) => e.currentTarget.style.setProperty("--spot", "0")}
      className={cn(
        "glass spotlight rounded-2xl shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-32px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
