import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A landing section laid out around the centre column, where the Solidity mark takes the
 * section's shape (`morph`, see hero/geometry.ts). Below lg the two sides simply stack.
 */
export function Split({
  morph,
  id,
  left,
  right,
  className,
  border = true,
}: {
  morph: string;
  id?: string;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  border?: boolean;
}) {
  return (
    <section
      id={id}
      data-morph={morph}
      className={cn("relative scroll-mt-16 py-20 sm:py-28 lg:flex lg:min-h-[92vh] lg:items-center lg:py-16", border && "border-t border-line", className)}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_var(--cmp-col)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:px-8">
        <div data-cmp-col="" className={cn("min-w-0", !left && "hidden lg:block")}>{left}</div>
        <div aria-hidden className="hidden lg:block" />
        <div data-cmp-col="" className={cn("min-w-0", !right && "hidden lg:block")}>{right}</div>
      </div>
    </section>
  );
}
