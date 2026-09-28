"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, Download, FilePlus2, Waypoints } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnchorGlyph, SealGlyph } from "@/components/brand/glyphs";
import { ACTIVITY, type Activity } from "@/data/activity";
import { DUR, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

const ICON = {
  seal: SealGlyph,
  flag: AlertTriangle,
  trace: Waypoints,
  verify: AnchorGlyph,
  intake: FilePlus2,
  export: Download,
} as const;

function ago(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const ITEMS: (Activity & { unread: boolean })[] = ACTIVITY.slice(0, 5).map((a, i) => ({ ...a, unread: i < 3 }));

/** Bell + popover of recent custody events. */
export function NotificationsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(ITEMS);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => i.unread).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("relative rounded-md p-2 text-fg-2 hover:bg-white/5 hover:text-fg", open && "bg-white/5 text-fg")}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-violet" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: DUR.fast, ease: EASE }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-line-strong bg-panel/95 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-[14.5px] font-medium text-fg">Notifications</span>
              <button
                onClick={() => setItems((xs) => xs.map((x) => ({ ...x, unread: false })))}
                disabled={!unread}
                className="text-[13px] text-violet-300 hover:text-violet-200 disabled:text-muted"
              >
                Mark all read
              </button>
            </div>
            <ul className="max-h-[360px] overflow-y-auto py-1">
              {items.map((a) => {
                const Icon = ICON[a.kind];
                return (
                  <li key={a.id}>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, unread: false } : x)));
                        setOpen(false);
                        if (a.caseId) router.push(`/cases/${a.caseId}`);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-line-strong bg-white/[0.03] text-fg-2">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[14px] leading-snug", a.unread ? "text-fg" : "text-fg-2")}>{a.text}</span>
                        <span className="mt-1 block font-mono text-[12px] text-muted">
                          {a.caseId} · {ago(a.at)}
                        </span>
                      </span>
                      {a.unread && <span className="mt-2 size-1.5 shrink-0 rounded-full bg-violet" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
