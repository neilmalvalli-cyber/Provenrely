import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-line-strong bg-black/30 px-3.5 text-[14.5px] text-fg placeholder:text-muted transition focus:border-violet/60 focus:bg-black/40 focus:outline-none focus:ring-4 focus:ring-violet/10",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-none rounded-lg border border-line-strong bg-black/30 px-3.5 py-3 text-[14.5px] leading-relaxed text-fg placeholder:text-muted transition focus:border-violet/60 focus:outline-none focus:ring-4 focus:ring-violet/10",
        className,
      )}
      {...props}
    />
  );
});

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-2 block text-[13.5px] font-medium text-fg-2", className)} {...props} />;
}
