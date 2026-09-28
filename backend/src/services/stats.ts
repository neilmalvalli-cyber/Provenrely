import type { Chain } from "../lib/chain.js";
import { createIncrementalCounter, type IncrementalOptions } from "../lib/incremental.js";
import { isoNow, type Stats } from "../types.js";

const TTL_MS = 60_000;

/**
 * Real counts from registry events, scanned incrementally in small block ranges from the deploy block
 * (MST limits log queries) and cached for a minute. A count that isn't available yet is null (UI: "—").
 */
export function createStats(chain: Chain, opts: Omit<IncrementalOptions, "retries" | "backoffMs"> & { retries?: number; backoffMs?: number }) {
  const flags = createIncrementalCounter((a, b) => chain.countEvents("Flagged", a, b), opts);
  const anchors = createIncrementalCounter((a, b) => chain.countEvents("CertificateAnchored", a, b), opts);
  let cached: { at: number; value: Stats } | null = null;

  return async function stats(): Promise<Stats> {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
    let flagsIssued: number | null = null;
    let certificatesAnchored: number | null = null;
    if (chain.configured) {
      try {
        const latest = await chain.latestBlock();
        [flagsIssued, certificatesAnchored] = await Promise.all([flags.refresh(latest), anchors.refresh(latest)]);
      } catch (e) {
        console.warn("[stats] couldn't read the latest block:", e instanceof Error ? e.message : e);
      }
    }
    const value: Stats = { flagsIssued, certificatesAnchored, transfersBlocked: null, updatedAt: isoNow() };
    if (flagsIssued !== null && certificatesAnchored !== null) cached = { at: Date.now(), value };
    return value;
  };
}
