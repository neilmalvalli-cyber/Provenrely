"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, FilePlus2, Lock, Search, SearchX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { SEVERITY } from "@/components/ui/badges";
import { Button, LinkButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Case, CaseStatus } from "@/data/types";
import { DUR, EASE, SPRING } from "@/lib/motion";
import { cn, formatNumber } from "@/lib/utils";
import { CaseRow, CaseTableHead, type Sort, type SortKey } from "./case-row";

const FILTERS: { key: CaseStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sealed", label: "Sealed" },
  { key: "review", label: "In review" },
  { key: "flagged", label: "Flagged" },
  { key: "draft", label: "Draft" },
];

const STATUS_ORDER: Record<CaseStatus, number> = { flagged: 0, review: 1, draft: 2, sealed: 3 };

function compare(a: Case, b: Case, key: SortKey) {
  switch (key) {
    case "id":
      return a.id.localeCompare(b.id);
    case "status":
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case "risk":
      return a.riskScore - b.riskScore;
    case "value":
      return a.valueTracedEth - b.valueTracedEth;
    case "opened":
      return +new Date(a.openedAt) - +new Date(b.openedAt);
  }
}

type Preview = { c: Case; top: number; left: number };

export function CaseLedger({ cases }: { cases: Case[] }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CaseStatus | "all">("all");
  const [sort, setSort] = useState<Sort>({ key: "opened", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Preview | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const canHover = useRef(false);

  useEffect(() => {
    canHover.current = window.matchMedia("(hover: hover) and (min-width: 1024px)").matches;
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: cases.length };
    for (const c of cases) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [cases]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cases
      .filter((c) => status === "all" || c.status === status)
      .filter((c) => !needle || [c.id, c.title, c.target, c.category, c.lead.name].some((f) => f.toLowerCase().includes(needle)))
      .sort((a, b) => compare(a, b, sort.key) * (sort.dir === "asc" ? 1 : -1));
  }, [cases, q, status, sort]);

  function onSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "id" ? "asc" : "desc" }));
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id));

  function onHover(c: Case | null, e?: MouseEvent<HTMLTableRowElement>) {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    if (!c || !e || !canHover.current) {
      setPreview(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimer.current = window.setTimeout(() => {
      const below = rect.bottom + 230 < window.innerHeight;
      setPreview({ c, left: Math.min(window.innerWidth - 376, rect.left + rect.width * 0.42), top: below ? rect.bottom + 6 : rect.top - 6 - 214 });
    }, 550);
  }

  return (
    <>
      <div className="glass relative overflow-clip rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={status === f.key}
                onClick={() => setStatus(f.key)}
                className={cn(
                  "relative flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-[13.5px] transition-colors",
                  status === f.key ? "text-fg" : "text-fg-2 hover:text-fg",
                )}
              >
                {status === f.key && <motion.span layoutId="ledger-filter" transition={SPRING} className="absolute inset-0 rounded-lg bg-white/[0.07]" />}
                <span className="relative">{f.label}</span>
                <span className="relative font-mono text-[11.5px] text-muted">{counts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by ID, title, address, lead"
              className="h-9 w-full rounded-lg border border-line bg-black/20 pl-9 pr-3 text-[13.5px] text-fg placeholder:text-muted transition-colors focus:border-violet/50 focus:outline-none"
              aria-label="Filter cases"
            />
          </div>
        </div>

        {rows.length ? (
          <div className="overflow-x-auto lg:overflow-x-visible">
            <table className="w-full">
              <CaseTableHead sticky sort={sort} onSort={onSort} selection={{ all: allSelected, some: someSelected, toggle: () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id))) }} />
              <tbody>
                {rows.map((c) => (
                  <CaseRow key={c.id} c={c} selected={selected.has(c.id)} onToggle={() => toggle(c.id)} onHover={onHover} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <div className="grid size-12 place-items-center rounded-2xl border border-line bg-white/[0.02]">
              <SearchX className="size-5 text-muted" />
            </div>
            <div className="mt-4 text-[14px] text-fg">No cases match</div>
            <p className="mt-1 max-w-xs text-[14px] text-fg-2">Try a different filter or search term, or open a new case.</p>
            <div className="mt-5 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setStatus("all");
                }}
              >
                Clear filters
              </Button>
              <LinkButton href="/intake" variant="secondary" size="sm">
                <FilePlus2 />
                New intake
              </LinkButton>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12.5px] text-muted">
          <span>
            {rows.length} of {cases.length} cases
          </span>
          <span className="font-mono">registry 0x4829…cc08</span>
        </div>
      </div>

      {/* hover preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            key={preview.c.id}
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: DUR.fast } }}
            transition={{ duration: DUR.base, ease: EASE }}
            className="pointer-events-none fixed z-40 w-[360px] rounded-xl border border-line-strong bg-panel/95 p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            style={{ top: preview.top, left: preview.left }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12.5px] text-violet-300">{preview.c.id}</span>
              <span className="text-[12px] text-muted">{preview.c.category}</span>
            </div>
            <div className="mt-1 text-[14px] font-medium text-fg">{preview.c.title}</div>
            <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-fg-2">{preview.c.summary}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3">
              {preview.c.riskFlags.slice(0, 3).map((f) => (
                <span key={f.id} className="flex items-center gap-1.5 text-[12.5px] text-fg-2">
                  <span className="size-1.5 rounded-full" style={{ background: SEVERITY[f.severity].color }} />
                  {f.name}
                </span>
              ))}
            </div>
            <div className="mt-3 font-mono text-[12px] text-muted">
              {formatNumber(preview.c.valueTracedEth)} ETH · {formatNumber(preview.c.txCount)} tx · {preview.c.linkedAddresses} addresses
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* bulk actions */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={SPRING}
            className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-line-strong bg-panel/95 p-1.5 pl-4 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:ml-30"
          >
            <span className="mr-2 whitespace-nowrap text-[14px] text-fg">
              <span className="font-mono">{selected.size}</span> selected
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toast({ title: `${selected.size} cases exported`, description: "solidity-cases.csv · simulated export" })}
            >
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toast({ title: "Seal requested", description: `${selected.size} cases sent to reviewers for approval.` })}
            >
              <Lock />
              <span className="hidden sm:inline">Request seal</span>
            </Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={() => setSelected(new Set())} aria-label="Clear selection">
              <X />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
