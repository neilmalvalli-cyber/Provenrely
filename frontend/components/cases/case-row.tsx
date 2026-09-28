"use client";

import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { ViewTransition, type MouseEvent } from "react";
import { RiskBadge, StatusBadge } from "@/components/ui/badges";
import { InlineHash } from "@/components/ui/hash-display";
import type { Case } from "@/data/types";
import { cn, formatNumber, formatUtc } from "@/lib/utils";

export type SortKey = "id" | "status" | "risk" | "value" | "opened";
export type Sort = { key: SortKey; dir: "asc" | "desc" };

function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate;
      }}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="size-3.5 cursor-pointer rounded accent-violet-500"
    />
  );
}

function Th({
  children,
  sortKey,
  sort,
  onSort,
  className,
}: {
  children: React.ReactNode;
  sortKey?: SortKey;
  sort?: Sort;
  onSort?: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey && sort?.key === sortKey;
  const Arrow = sort?.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn("px-3 py-2.5 text-left text-[12.5px] font-normal text-muted", className)}
      aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      {sortKey && onSort ? (
        <button onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 transition-colors hover:text-fg", active && "text-fg")}>
          {children}
          <Arrow className={cn("size-3 transition-opacity", active ? "opacity-100" : "opacity-0")} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function CaseTableHead({
  dense = false,
  sort,
  onSort,
  selection,
  sticky = false,
}: {
  dense?: boolean;
  /** Pin under the top bar while scrolling (only valid outside scroll containers). */
  sticky?: boolean;
  sort?: Sort;
  onSort?: (k: SortKey) => void;
  selection?: { all: boolean; some: boolean; toggle: () => void };
}) {
  return (
    <thead className={cn(sticky && "lg:sticky lg:top-14 lg:z-10 lg:bg-panel/95 lg:backdrop-blur-xl")}>
      <tr className="border-b border-line">
        {selection && (
          <th className="w-10 pl-5">
            <Checkbox checked={selection.all} indeterminate={selection.some && !selection.all} onChange={selection.toggle} label="Select all cases" />
          </th>
        )}
        <Th sortKey="id" sort={sort} onSort={onSort} className={selection ? "pl-2" : "pl-5"}>
          Case
        </Th>
        <Th className="hidden md:table-cell">Target</Th>
        <Th sortKey="status" sort={sort} onSort={onSort}>
          Status
        </Th>
        <Th sortKey="risk" sort={sort} onSort={onSort}>
          Risk
        </Th>
        {!dense && (
          <Th sortKey="value" sort={sort} onSort={onSort} className="hidden text-right xl:table-cell">
            Traced
          </Th>
        )}
        {!dense && <Th className="hidden lg:table-cell">Lead</Th>}
        <Th sortKey="opened" sort={sort} onSort={onSort} className="hidden sm:table-cell">
          Opened
        </Th>
        <th className="w-8" />
      </tr>
    </thead>
  );
}

export function CaseRow({
  c,
  dense = false,
  selected,
  onToggle,
  onHover,
}: {
  c: Case;
  dense?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  onHover?: (c: Case | null, e?: MouseEvent<HTMLTableRowElement>) => void;
}) {
  const router = useRouter();
  const href = `/cases/${c.id}`;
  return (
    <tr
      onClick={() => router.push(href)}
      onKeyDown={(e) => e.key === "Enter" && router.push(href)}
      onMouseEnter={(e) => onHover?.(c, e)}
      onMouseLeave={() => onHover?.(null)}
      tabIndex={0}
      className={cn(
        "group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-white/[0.025] focus:bg-white/[0.035] focus:outline-none",
        selected && "bg-violet/[0.05] hover:bg-violet/[0.07]",
      )}
    >
      {onToggle && (
        <td className="w-10 pl-5">
          <Checkbox checked={!!selected} onChange={onToggle} label={`Select ${c.id}`} />
        </td>
      )}
      <td className={cn("py-3 pr-3", onToggle ? "pl-2" : "pl-5")}>
        <ViewTransition name={`case-id-${c.id}`}>
          <div className="w-fit font-mono text-[12.5px] text-violet-300">{c.id}</div>
        </ViewTransition>
        <ViewTransition name={`case-title-${c.id}`}>
          <div className="mt-0.5 w-fit max-w-[240px] truncate text-[14px] text-fg">{c.title}</div>
        </ViewTransition>
      </td>
      <td className="hidden px-3 py-3 md:table-cell">
        <InlineHash value={c.target} head={8} tail={4} />
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={c.status} />
      </td>
      <td className="px-3 py-3">
        <RiskBadge score={c.riskScore} />
      </td>
      {!dense && (
        <td className="hidden px-3 py-3 text-right font-mono text-[13px] tabular-nums text-fg-2 xl:table-cell">{formatNumber(c.valueTracedEth)} ETH</td>
      )}
      {!dense && (
        <td className="hidden px-3 py-3 lg:table-cell">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-white/[0.06] text-[9.5px] font-medium text-fg-2">{c.lead.initials}</span>
            <span className="text-[13.5px] text-fg-2">{c.lead.name}</span>
          </div>
        </td>
      )}
      <td className="hidden px-3 py-3 font-mono text-[12.5px] tabular-nums text-muted sm:table-cell">{formatUtc(c.openedAt).slice(0, 10)}</td>
      <td className="pr-4">
        <ChevronRight className="size-4 text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </td>
    </tr>
  );
}
