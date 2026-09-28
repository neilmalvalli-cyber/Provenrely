import { ScanSearch } from "lucide-react";
import { AnchorGlyph, MerkleGlyph, SealGlyph } from "@/components/brand/glyphs";

/** The four steps from a scan to a checkable certificate (shared by the sealing story and the landing page). */
export const STAGES = [
  {
    key: "collect",
    icon: ScanSearch,
    title: "Scan",
    body: "Paste an MST address. You get a verdict — safe, suspicious or high risk — with a score, the reasons, and a plain explanation in English or Hindi.",
  },
  {
    key: "hash",
    icon: SealGlyph,
    title: "Certify",
    body: "The verdict and its reasons become a certificate. Its fields are serialised canonically with a random salt and fingerprinted with SHA-256.",
  },
  {
    key: "commit",
    icon: MerkleGlyph,
    title: "Anchor",
    body: "Only that fingerprint is written to the registry on MST, with the block time. The certificate itself stays with you.",
  },
  {
    key: "anchor",
    icon: AnchorGlyph,
    title: "Verify & protect",
    body: "Anyone can recompute the hash and check it on MST. Issuers flag fraud addresses, and SafeSend blocks transfers to them on-chain.",
  },
] as const;

/** The parts of an example certificate (as the sealing story shows them). */
export const EVIDENCE_ITEMS = [
  { label: "Verdict & score", meta: "High risk · 90 / 100" },
  { label: "Reasons", meta: "3 indicators" },
  { label: "Explanation", meta: "English · हिन्दी" },
  { label: "Salt", meta: "32 random bytes" },
] as const;
