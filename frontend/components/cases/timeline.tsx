import { AlertTriangle, Download, FilePlus2, NotebookPen, Waypoints } from "lucide-react";
import { AnchorGlyph, SealGlyph } from "@/components/brand/glyphs";
import type { TimelineEvent } from "@/data/types";
import { cn, formatUtc, shortHash } from "@/lib/utils";

const ICON = {
  intake: FilePlus2,
  trace: Waypoints,
  flag: AlertTriangle,
  note: NotebookPen,
  seal: SealGlyph,
  verify: AnchorGlyph,
  export: Download,
} as const;

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative">
      {events.map((e, i) => {
        const Icon = ICON[e.kind];
        const emphasis = e.kind === "seal" || e.kind === "verify";
        return (
          <li key={i} className="relative grid grid-cols-[28px_1fr] gap-4 pb-6 last:pb-0">
            {i < events.length - 1 && (
              <span
                className={cn(
                  "absolute left-[13.5px] top-8 bottom-0 w-px",
                  emphasis ? "bg-gradient-to-b from-violet/60 to-line" : "bg-line",
                )}
              />
            )}
            <span
              className={cn(
                "relative grid size-7 place-items-center rounded-lg border",
                emphasis
                  ? "border-violet/35 bg-violet/10 text-violet-200"
                  : e.kind === "flag"
                    ? "border-red-400/20 bg-red-500/[0.07] text-red-300/90"
                    : "border-line-strong bg-white/[0.03] text-fg-2",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[14.5px] text-fg">{e.title}</span>
                <span className="font-mono text-[11.5px] text-muted">{formatUtc(e.at)}</span>
              </div>
              <p className="mt-1 text-[13.5px] text-fg-2">{e.detail}</p>
              <div className="mt-1.5 flex items-center gap-3 text-[12px] text-muted">
                <span>{e.actor}</span>
                {e.ref && <code className="font-mono text-violet-300">{shortHash(e.ref, 8, 6)}</code>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
