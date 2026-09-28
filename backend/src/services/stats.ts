import { id } from "ethers";
import type { Chain } from "../lib/chain.js";
import type { Explorer } from "../lib/explorer.js";
import { createIncrementalCounter, type IncrementalOptions } from "../lib/incremental.js";
import { isoNow, type Stats } from "../types.js";

const TTL_MS = 60_000;
/** SafeSend.send(address) — the only call whose failures count as blocked transfers. */
export const SEND_SELECTOR = id("send(address)").slice(0, 10);

export interface StatsOptions extends Omit<IncrementalOptions, "chunkSize" | "maxChunksPerRefresh"> {
  /** Blocks per registry log query (MST limits log ranges). */
  chunkSize: number;
  maxChunksPerRefresh: number;
  safeSendAddress?: string | null;
  /** Explorer range per query when counting failed SafeSend calls (the explorer handles large ranges). */
  explorerChunkSize?: number;
  /** RPC fallback: blocks read per query and per refresh when there is no explorer. */
  blockScan?: { chunkSize: number; maxChunksPerRefresh: number };
}

/**
 * Real counts, scanned incrementally from the deploy block and cached for a minute:
 * - flagsIssued / certificatesAnchored from registry events, in small log ranges;
 * - transfersBlocked = failed SafeSend.send transactions (a revert leaves no event), from the
 *   explorer's transaction list, or by reading blocks and receipts over RPC when there is no explorer.
 * Anything unavailable, or still catching up, is null (the UI hides or shows "—").
 */
export function createStats(chain: Chain, explorer: Explorer, opts: StatsOptions) {
  const logOpts = { startBlock: opts.startBlock, chunkSize: opts.chunkSize, maxChunksPerRefresh: opts.maxChunksPerRefresh, retries: opts.retries, backoffMs: opts.backoffMs };
  const flags = createIncrementalCounter((a, b) => chain.countEvents("Flagged", a, b), logOpts);
  const anchors = createIncrementalCounter((a, b) => chain.countEvents("CertificateAnchored", a, b), logOpts);

  const safeSend = opts.safeSendAddress ?? null;
  const viaExplorer = explorer.countFailedCalls?.bind(explorer);
  const blocked = !safeSend
    ? null
    : viaExplorer
      ? createIncrementalCounter((a, b) => viaExplorer(safeSend, SEND_SELECTOR, a, b), { ...logOpts, chunkSize: opts.explorerChunkSize ?? 500_000 })
      : createIncrementalCounter((a, b) => chain.countFailedCalls(safeSend, SEND_SELECTOR, a, b), {
          ...logOpts,
          ...(opts.blockScan ?? { chunkSize: 50, maxChunksPerRefresh: 20 }),
        });

  let cached: { at: number; value: Stats } | null = null;

  return async function stats(): Promise<Stats> {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
    let flagsIssued: number | null = null;
    let certificatesAnchored: number | null = null;
    let transfersBlocked: number | null = null;
    if (chain.configured) {
      try {
        const latest = await chain.latestBlock();
        [flagsIssued, certificatesAnchored, transfersBlocked] = await Promise.all([
          flags.refresh(latest),
          anchors.refresh(latest),
          blocked ? blocked.refresh(latest) : Promise.resolve(null),
        ]);
      } catch (e) {
        console.warn("[stats] couldn't read the latest block:", e instanceof Error ? e.message : e);
      }
    }
    const value: Stats = { flagsIssued, certificatesAnchored, transfersBlocked, updatedAt: isoNow() };
    const complete = flagsIssued !== null && certificatesAnchored !== null && (transfersBlocked !== null || !blocked);
    if (complete) cached = { at: Date.now(), value };
    return value;
  };
}
