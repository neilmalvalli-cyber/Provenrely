"use client";

import { useMemo } from "react";
import { GraphLegend, NetworkGraph } from "@/components/network/network-graph";
import { buildGraph } from "@/data/graph";

export function MiniGraph({ caseId, target, risk }: { caseId: string; target: string; risk: number }) {
  const g = useMemo(() => buildGraph(caseId, target, risk), [caseId, target, risk]);
  return (
    <div className="relative">
      <NetworkGraph nodes={g.nodes} edges={g.edges} compact className="relative" />
      <GraphLegend className="relative border-t border-line px-5 py-3" />
    </div>
  );
}
