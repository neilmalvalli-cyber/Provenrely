"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CornerDownLeft,
  ExternalLink,
  FilePlus2,
  FileCheck2,
  FolderKanban,
  Globe,
  Keyboard,
  LayoutGrid,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DUR, EASE } from "@/lib/motion";
import { explorer } from "@/lib/chain/explorer";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  group: "Go to" | "Actions" | "Lookup";
  label: string;
  hint?: string;
  keywords?: string;
  icon?: LucideIcon;
  shortcut?: string[];
  href: string;
};

const PAGES: Item[] = [
  { id: "p-dash", group: "Go to", label: "Dashboard", href: "/dashboard", icon: LayoutGrid, shortcut: ["G", "D"] },
  { id: "p-scan", group: "Go to", label: "Scan", href: "/scan", icon: FilePlus2, shortcut: ["G", "S"] },
  { id: "p-shield", group: "Go to", label: "Shield", href: "/shield", icon: ShieldCheck, shortcut: ["G", "H"] },
  { id: "p-issuer", group: "Go to", label: "Issuer", href: "/issuer", icon: FolderKanban, shortcut: ["G", "I"] },
  { id: "p-verify", group: "Go to", label: "Verify", href: "/verify", icon: ShieldCheck, shortcut: ["G", "V"] },
  { id: "p-site", group: "Go to", label: "Website", href: "/", icon: Globe, keywords: "home landing" },
];

const ACTIONS: Item[] = [
  { id: "a-scan", group: "Actions", label: "Scan an address", hint: "Risk verdict for an address", href: "/scan", icon: FilePlus2, shortcut: ["N"] },
];

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "Open command palette" },
  { keys: ["/"], label: "Search" },
  { keys: ["G", "D"], label: "Go to dashboard" },
  { keys: ["G", "S"], label: "Go to scan" },
  { keys: ["G", "V"], label: "Go to verify" },
  { keys: ["G", "H"], label: "Go to shield" },
  { keys: ["G", "I"], label: "Go to issuer" },
  { keys: ["N"], label: "Scan an address" },
  { keys: ["?"], label: "Show shortcuts" },
];

const Ctx = createContext<{ open: () => void; openShortcuts: () => void }>({ open: () => {}, openShortcuts: () => {} });
export const useCommandPalette = () => useContext(Ctx);

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-grid h-5 min-w-5 place-items-center rounded border border-line-strong bg-white/[0.03] px-1 font-sans text-[11.5px] text-fg-2", className)}>
      {children}
    </kbd>
  );
}

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "search" | "shortcuts">(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const gPending = useRef<number | null>(null);

  const open = useCallback(() => {
    setQ("");
    setActive(0);
    setMode("search");
  }, []);
  const openShortcuts = useCallback(() => setMode("shortcuts"), []);
  const close = useCallback(() => setMode(null), []);

  const items = useMemo<Item[]>(() => {
    const raw = q.trim();
    const needle = raw.toLowerCase();
    const lookup: Item[] = [];
    if (/^0x[0-9a-f]{40}$/.test(needle)) {
      lookup.push({ id: "l-scan", group: "Lookup", label: "Scan this address", hint: "Risk verdict", href: `/scan?address=${raw}`, icon: FilePlus2 });
    } else if (/^0x[0-9a-f]{64}$/.test(needle)) {
      lookup.push({ id: "l-tx", group: "Lookup", label: "View transaction on MSTScan", hint: "Opens in a new tab", href: explorer.tx(needle), icon: ExternalLink });
    } else if (/^(cert|sample)_[0-9a-z_-]+$/i.test(raw)) {
      lookup.push({ id: "l-cert", group: "Lookup", label: `Verify certificate ${raw}`, hint: "Checks its anchor on MST", href: `/verify?cert=${encodeURIComponent(raw)}`, icon: FileCheck2 });
    }
    const all = [...lookup, ...ACTIONS, ...PAGES];
    if (!needle) return all;
    return all.filter((i) => i.group === "Lookup" || `${i.label} ${i.keywords ?? ""} ${i.hint ?? ""}`.toLowerCase().includes(needle));
  }, [q]);

  const go = useCallback(
    (href: string) => {
      setMode(null);
      if (/^https?:\/\//.test(href)) window.open(href, "_blank", "noopener,noreferrer");
      else router.push(href);
    },
    [router],
  );

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (mode === "search") close();
        else open();
        return;
      }
      if (mode && e.key === "Escape") {
        close();
        return;
      }
      if (mode || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (gPending.current) {
        window.clearTimeout(gPending.current);
        gPending.current = null;
        const map: Record<string, string> = { d: "/dashboard", s: "/scan", v: "/verify", h: "/shield", i: "/issuer" };
        if (map[k]) {
          e.preventDefault();
          router.push(map[k]);
        }
        return;
      }
      if (k === "g") {
        gPending.current = window.setTimeout(() => (gPending.current = null), 900);
      } else if (k === "/") {
        e.preventDefault();
        open();
      } else if (k === "n") {
        router.push("/scan");
      } else if (e.key === "?") {
        openShortcuts();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, open, close, openShortcuts, router]);

  useEffect(() => {
    if (mode === "search") setTimeout(() => inputRef.current?.focus(), 10);
  }, [mode]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      go(items[active].href);
    } else if (e.key === "Escape") {
      close();
    }
  }

  let idx = -1;
  const groups = (["Lookup", "Actions", "Go to"] as const).map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter((x) => x.list.length);

  return (
    <Ctx.Provider value={{ open, openShortcuts }}>
      {children}
      <AnimatePresence>
        {mode && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast }}
            onMouseDown={(e) => e.target === e.currentTarget && close()}
            onKeyDown={(e) => e.key === "Escape" && close()}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={mode === "search" ? "Command palette" : "Keyboard shortcuts"}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: DUR.base, ease: EASE }}
              className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-line-strong bg-panel/95 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
            >
              {mode === "search" ? (
                <>
                  <div className="flex items-center gap-3 border-b border-line px-4">
                    <Search className="size-4 text-muted" />
                    <input
                      ref={inputRef}
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setActive(0);
                      }}
                      onKeyDown={onInputKey}
                      placeholder="Search addresses, certificates, tx hashes"
                      className="h-14 flex-1 bg-transparent text-[14.5px] text-fg outline-none placeholder:text-muted"
                      aria-label="Search"
                      aria-activedescendant={items[active] ? `cp-${items[active].id}` : undefined}
                      spellCheck={false}
                    />
                    <Kbd>Esc</Kbd>
                  </div>
                  <div ref={listRef} className="max-h-[min(420px,55vh)] overflow-y-auto p-2" role="listbox">
                    {groups.length === 0 && <div className="px-3 py-10 text-center text-[14px] text-muted">No results for “{q}”</div>}
                    {groups.map(({ g, list }) => (
                      <div key={g} className="mb-1">
                        <div className="px-3 pb-1 pt-2.5 text-[12px] text-muted">{g}</div>
                        {list.map((it) => {
                          idx++;
                          const i = idx;
                          const on = i === active;
                          const Icon = it.icon;
                          return (
                            <button
                              key={it.id}
                              id={`cp-${it.id}`}
                              data-idx={i}
                              role="option"
                              aria-selected={on}
                              onMouseMove={() => setActive(i)}
                              onClick={() => go(it.href)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                                on ? "bg-white/[0.07]" : "hover:bg-white/[0.03]",
                              )}
                            >
                              {Icon ? <Icon className={cn("size-4", on ? "text-violet-300" : "text-muted")} /> : <span className="size-4" />}
                              <span className="min-w-0 flex-1 truncate text-[14.5px] text-fg">{it.label}</span>
                              {it.hint && <span className="hidden truncate font-mono text-[12px] text-muted sm:inline">{it.hint}</span>}
                              {it.shortcut && (
                                <span className="hidden gap-1 sm:flex">
                                  {it.shortcut.map((k) => (
                                    <Kbd key={k}>{k}</Kbd>
                                  ))}
                                </span>
                              )}
                              {on && <CornerDownLeft className="size-3.5 text-muted" />}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
                    <span className="flex items-center gap-1.5">
                      <Kbd>↑</Kbd>
                      <Kbd>↓</Kbd> navigate
                      <Kbd className="ml-2">↵</Kbd> open
                    </span>
                    <button onClick={openShortcuts} className="flex items-center gap-1.5 hover:text-fg">
                      <Keyboard className="size-3.5" /> Shortcuts <Kbd>?</Kbd>
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-2">
                  <div className="flex items-center justify-between px-3 py-3">
                    <span className="text-[14px] font-medium text-fg">Keyboard shortcuts</span>
                    <Kbd>Esc</Kbd>
                  </div>
                  <ul className="pb-2">
                    {SHORTCUTS.map((s) => (
                      <li key={s.label} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-[14px] text-fg-2 hover:bg-white/[0.03]">
                        {s.label}
                        <span className="flex gap-1">
                          {s.keys.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
