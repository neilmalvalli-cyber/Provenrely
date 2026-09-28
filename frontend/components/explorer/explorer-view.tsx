"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Crosshair, MousePointerClick } from "lucide-react";
import { SPRING } from "@/lib/motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { GraphLegend, NetworkGraph } from "@/components/network/network-graph";
import { RiskBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { HashDisplay } from "@/components/ui/hash-display";
import { DataField, GlassPanel, PageHeader, PanelHeader } from "@/components/ui/panel";
import { getCases } from "@/data/cases";
import { NODE_META, buildGraph } from "@/data/graph";
import { cn, formatNumber, shortHash } from "@/lib/utils";

export function ExplorerView() {
  const router = useRouter();
  const params = useSearchParams();
  const cases = getCases();
  const current = cases.find((c) => c.id === params.get("case")) ?? cases[0];
  const [selected, setSelected] = useState<string | null>("t");
  const [hop, setHop] = useState<"all" | 1>("all");
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());

  const graph = useMemo(() => buildGraph(current.id, current.target, current.riskScore), [current]);
  const visible = useMemo(
    () =>
      new Set(
        graph.nodes
          .filter((n) => n.kind === "target" || ((hop === "all" || n.id.startsWith("h1")) && !hiddenKinds.has(n.kind)))
          .map((n) => n.id),
      ),
    [graph, hop, hiddenKinds],
  );
  const node = graph.nodes.find((n) => n.id === selected && visible.has(n.id)) ?? null;
  const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const vEdges = graph.edges.filter((e) => visible.has(e.from) && visible.has(e.to));
  const flows = node ? vEdges.filter((e) => e.from === node.id || e.to === node.id) : [...vEdges].sort((a, b) => b.valueEth - a.valueEth).slice(0, 8);

  return (
    <>
      <PageHeader
        eyebrow="Explorer"
        title="Transaction graph"
        description="Follow value out from the target. Select any node to inspect it and highlight its flows."
        actions={
          <label className="flex items-center gap-2">
            <span className="text-[13.5px] text-muted">Case</span>
            <select
              value={current.id}
              onChange={(e) => {
                setSelected("t");
                router.replace(`/explorer?case=${e.target.value}`);
              }}
              className="h-10 rounded-lg border border-line-strong bg-black/30 px-3 font-mono text-[13.5px] text-fg focus:border-violet/50 focus:outline-none"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.title}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <GlassPanel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[13px] text-violet-300">{current.id}</span>
              <StatusBadge status={current.status} />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-line p-0.5" role="tablist" aria-label="Trace depth">
                {(["all", 1] as const).map((h) => (
                  <button
                    key={h}
                    role="tab"
                    aria-selected={hop === h}
                    onClick={() => setHop(h)}
                    className={cn("relative h-6 rounded-md px-2.5 text-[12.5px] transition-colors", hop === h ? "text-fg" : "text-muted hover:text-fg-2")}
                  >
                    {hop === h && <motion.span layoutId="hop-pill" transition={SPRING} className="absolute inset-0 rounded-md bg-white/[0.08]" />}
                    <span className="relative">{h === "all" ? "2 hops" : "1 hop"}</span>
                  </button>
                ))}
              </div>
              <span className="hidden font-mono text-[12px] text-muted xl:inline">
                {visible.size} nodes · {vEdges.length} flows
              </span>
              <Button size="sm" variant="ghost" onClick={() => setSelected("t")}>
                <Crosshair />
                Recenter
              </Button>
            </div>
          </div>
          <div className="relative">
            <NetworkGraph
              key={current.id}
              nodes={graph.nodes}
              edges={graph.edges}
              visible={visible}
              selectedId={selected}
              onSelect={(id) => setSelected((s) => (s === id ? null : id))}
              interactive
              className="relative"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            <GraphLegend
              hidden={hiddenKinds}
              onToggle={(k) =>
                setHiddenKinds((prev) => {
                  const n = new Set(prev);
                  if (n.has(k)) n.delete(k);
                  else n.add(k);
                  return n;
                })
              }
            />
            <span className="hidden items-center gap-1.5 text-[12px] text-muted md:flex">
              <MousePointerClick className="size-3.5" />
              Click to inspect · drag to pan · scroll to zoom
            </span>
          </div>
        </GlassPanel>

        <GlassPanel>
          <PanelHeader title={node ? node.label : "Inspector"} />
          <AnimatePresence mode="wait">
            {node ? (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-5 p-5"
              >
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: NODE_META[node.kind].color, boxShadow: `0 0 8px ${NODE_META[node.kind].color}` }} />
                  <span className="text-[13.5px] text-fg-2">{NODE_META[node.kind].name}</span>
                </div>
                <HashDisplay label="Address" value={node.address} full />
                <div className="grid grid-cols-2 gap-4">
                  <DataField label="Risk">
                    <RiskBadge score={node.risk} />
                  </DataField>
                  <DataField label="Balance" mono>
                    {formatNumber(node.balanceEth)} ETH
                  </DataField>
                  <DataField label="Transactions" mono>
                    {node.txCount}
                  </DataField>
                  <DataField label="Connections" mono>
                    {flows.length}
                  </DataField>
                </div>
                {node.kind === "target" && (
                  <Link href={`/cases/${current.id}`} className="flex items-center gap-1 text-[13px] text-violet-300 hover:text-violet-200">
                    Open case {current.id} <ArrowRight className="size-3" />
                  </Link>
                )}
              </motion.div>
            ) : (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 text-[14px] text-fg-2">
                Select a node in the graph to see its address, balance and flows.
              </motion.p>
            )}
          </AnimatePresence>
        </GlassPanel>
      </div>

      <GlassPanel className="mt-4 overflow-hidden">
        <PanelHeader title={node ? `Flows involving ${shortHash(node.address)}` : "Largest flows"} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-5 py-3 text-[12.5px] font-normal text-muted text-left">From</th>
                <th className="px-3 py-3 text-[12.5px] font-normal text-muted text-left">To</th>
                <th className="px-3 py-3 text-[12.5px] font-normal text-muted text-left">Hop</th>
                <th className="px-3 py-3 text-right text-[12.5px] font-normal text-muted">Txs</th>
                <th className="px-5 py-3 text-right text-[12.5px] font-normal text-muted">Value</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((e, i) => {
                const a = byId[e.from];
                const b = byId[e.to];
                return (
                  <tr key={i} className="border-b border-line last:border-0 hover:bg-white/[0.02]">
                    {[a, b].map((n, j) => (
                      <td key={j} className={cn("py-3", j === 0 ? "px-5" : "px-3")}>
                        <button onClick={() => setSelected(n.id)} className="flex items-center gap-2 text-left">
                          <span className="size-1.5 rounded-full" style={{ background: NODE_META[n.kind].color }} />
                          <span className="text-[13.5px] text-fg">{n.label}</span>
                          <code className="font-mono text-[12px] text-muted">{shortHash(n.address, 6, 4)}</code>
                        </button>
                      </td>
                    ))}
                    <td className="px-3 py-3 font-mono text-[13px] text-fg-2">{e.hop}</td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] text-fg-2">{e.txs}</td>
                    <td className="px-5 py-3 text-right font-mono text-[13px] tabular-nums text-fg">{formatNumber(e.valueEth)} ETH</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </>
  );
}
