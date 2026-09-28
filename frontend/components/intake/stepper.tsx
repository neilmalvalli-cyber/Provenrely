import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full border font-mono text-[11.5px] transition-all",
                done && "border-violet/50 bg-violet/20 text-violet-200",
                active && "border-violet bg-brand text-white shadow-[0_0_16px_-2px_rgba(168,85,247,0.8)]",
                !done && !active && "border-line-strong text-muted",
              )}
            >
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={cn("text-[13.5px]", active ? "text-fg" : done ? "text-fg-2" : "text-muted")}>{s}</span>
            {i < steps.length - 1 && <span className={cn("mx-1 h-px w-8 sm:w-12", done ? "bg-violet/50" : "bg-line-strong")} />}
          </li>
        );
      })}
    </ol>
  );
}
