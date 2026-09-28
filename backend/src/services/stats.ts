import type { Chain } from "../lib/chain.js";
import { isoNow, type Stats } from "../types.js";

const TTL_MS = 60_000;

/** Real counts from registry events, cached for a minute. Anything unavailable is null (the UI shows "—"). */
export function createStats(chain: Chain) {
  let cached: { at: number; value: Stats } | null = null;
  return async function stats(): Promise<Stats> {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
    let counts: { flagsIssued: number | null; certificatesAnchored: number | null } = { flagsIssued: null, certificatesAnchored: null };
    if (chain.configured) {
      try {
        counts = await chain.counts();
      } catch (e) {
        console.warn("[stats] counting events failed:", e instanceof Error ? e.message : e);
      }
    }
    const value: Stats = { ...counts, transfersBlocked: null, updatedAt: isoNow() };
    if (counts.flagsIssued !== null) cached = { at: Date.now(), value };
    return value;
  };
}
