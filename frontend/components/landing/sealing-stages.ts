import { Layers } from "lucide-react";
import { AnchorGlyph, MerkleGlyph, SealGlyph } from "@/components/brand/glyphs";

/** The four sealing steps (shared by the sealing story and the landing page). */
export const STAGES = [
  {
    key: "collect",
    icon: Layers,
    title: "Collect",
    body: "Traces, the chain snapshot, your findings and attachments become one evidence bundle.",
  },
  {
    key: "hash",
    icon: SealGlyph,
    title: "Hash",
    body: "Every item is fingerprinted with SHA-256. Change a single byte and its hash changes completely.",
  },
  {
    key: "commit",
    icon: MerkleGlyph,
    title: "Commit",
    body: "The fingerprints are combined pairwise into a Merkle tree, down to a single root.",
  },
  {
    key: "anchor",
    icon: AnchorGlyph,
    title: "Anchor",
    body: "Only the root is published on-chain. The evidence stays private; its integrity becomes public.",
  },
] as const;

/** The evidence items of the demo case (as the sealing story shows them). */
export const EVIDENCE_ITEMS = [
  { label: "Transaction traces", meta: "312 tx · 48 addresses" },
  { label: "Chain snapshot", meta: "block #6,892,104" },
  { label: "Investigator findings", meta: "3 indicators" },
  { label: "Attachments", meta: "2 files" },
] as const;
