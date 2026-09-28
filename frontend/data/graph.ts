import { mockHash } from "@/lib/utils";
import type { GraphEdge, GraphNode, NodeKind } from "./types";

/** Deterministic PRNG so every case always renders the same graph. */
function rng(seed: string) {
  let s = 0x811c9dc5;
  for (const ch of seed) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LABELS: Record<Exclude<NodeKind, "target">, string[]> = {
  wallet: ["Fan-out wallet", "Consolidation wallet", "Peel wallet", "Intermediary wallet"],
  bridge: ["Bridge router", "Bridge escrow"],
  mixer: ["Mixer pool"],
  contract: ["Swap contract", "Lending pool", "DEX router"],
  exchange: ["Exchange deposit"],
};

const round = (n: number) => Math.round(n);

/**
 * Builds a two-hop graph whose shape is specific to the case: node count,
 * composition, layout (even radial vs. directional fan-out), distances and
 * branching all derive from the case id, and mixers only appear for high-risk
 * cases. Coordinates live in a 1000×600 box, rounded so SSR and client match.
 */
export function buildGraph(caseId: string, target: string, targetRisk = 90): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const r = rng(caseId);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const cx = 500;
  const cy = 300;

  const nodes: GraphNode[] = [
    { id: "t", kind: "target", label: "Target", address: target, x: cx, y: cy, risk: targetRisk, balanceEth: +(r() * 40).toFixed(2), txCount: round(40 + r() * 400) },
  ];
  const edges: GraphEdge[] = [];

  // --- first hop: composition ---
  const n1 = 4 + Math.floor(r() * 5); // 4–8
  const pool: Exclude<NodeKind, "target">[] = ["wallet", "wallet", "wallet", "contract", "bridge", "exchange"];
  if (targetRisk >= 85) pool.push("mixer", "mixer");
  const kinds = Array.from({ length: n1 }, () => pick(pool));
  if (!kinds.includes("wallet")) kinds[0] = "wallet";
  // The highest-risk cases all involve a mixer in their findings; make sure it's visible.
  if (targetRisk >= 95 && !kinds.includes("mixer")) kinds[n1 - 1] = "mixer";

  // --- first hop: layout ---
  const fan = r() > 0.45; // directional fan-out vs. even radial spread
  const base = r() * Math.PI * 2;
  const arc = fan ? Math.PI * (0.9 + r() * 0.5) : Math.PI * 2;
  const angles = kinds.map((_, i) => {
    const t = fan ? (n1 === 1 ? 0.5 : i / (n1 - 1)) : i / n1;
    return base + (t - (fan ? 0.5 : 0)) * arc + (r() - 0.5) * (fan ? 0.18 : 0.45);
  });

  kinds.forEach((kind, i) => {
    const a = angles[i];
    const rad = 150 + r() * 80;
    const id = `h1-${i}`;
    nodes.push({
      id,
      kind,
      label: pick(LABELS[kind]),
      address: mockHash(`${caseId}-${id}`, 20),
      x: round(cx + Math.cos(a) * rad * 1.3),
      y: round(cy + Math.sin(a) * rad * 0.95),
      risk: kind === "mixer" ? 96 : round(30 + r() * 60),
      balanceEth: +(r() * 300).toFixed(2),
      txCount: round(3 + r() * 150),
    });
    edges.push({ from: "t", to: id, valueEth: +(10 + r() * 480).toFixed(1), txs: round(1 + r() * 14), hop: 1 });

    // --- second hop: branching depends on what the node is ---
    const maxKids = kind === "wallet" ? 3 : kind === "mixer" || kind === "bridge" ? 2 : 1;
    const kids = Math.floor(r() * (maxKids + 1));
    for (let j = 0; j < kids; j++) {
      const a2 = a + (j - (kids - 1) / 2) * (0.24 + r() * 0.18);
      const rad2 = 300 + r() * 110;
      const id2 = `h2-${i}-${j}`;
      const k2: NodeKind = kind === "bridge" ? pick(["wallet", "exchange"]) : r() > 0.72 ? "exchange" : "wallet";
      nodes.push({
        id: id2,
        kind: k2,
        label: k2 === "exchange" ? "Exchange deposit" : "Downstream wallet",
        address: mockHash(`${caseId}-${id2}`, 20),
        x: round(Math.min(960, Math.max(40, cx + Math.cos(a2) * rad2 * 1.25))),
        y: round(Math.min(565, Math.max(35, cy + Math.sin(a2) * rad2 * 0.72))),
        risk: round(10 + r() * 65),
        balanceEth: +(r() * 90).toFixed(2),
        txCount: round(2 + r() * 40),
      });
      edges.push({ from: id, to: id2, valueEth: +(3 + r() * 140).toFixed(1), txs: round(1 + r() * 6), hop: 2 });
    }
  });

  // --- an occasional consolidation link between first-hop nodes ---
  if (n1 >= 5 && r() > 0.4) {
    const i = Math.floor(r() * n1);
    const j = (i + 1 + Math.floor(r() * (n1 - 1))) % n1;
    edges.push({ from: `h1-${i}`, to: `h1-${j}`, valueEth: +(5 + r() * 90).toFixed(1), txs: round(1 + r() * 4), hop: 2 });
  }

  // Directional fans can sit off to one side; recentre the whole graph in the frame.
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const dx = round(cx - (Math.min(...xs) + Math.max(...xs)) / 2);
  const dy = round(cy - (Math.min(...ys) + Math.max(...ys)) / 2);
  for (const n of nodes) {
    n.x += dx;
    n.y += dy;
  }

  return { nodes, edges };
}

export const NODE_META: Record<NodeKind, { color: string; name: string }> = {
  target: { color: "#A78BFA", name: "Target" },
  wallet: { color: "#6E8FD6", name: "Wallet" },
  mixer: { color: "#EF5B5B", name: "Mixer" },
  bridge: { color: "#F0A940", name: "Bridge" },
  exchange: { color: "#5CCFE6", name: "Exchange" },
  contract: { color: "#8A91A0", name: "Contract" },
};
