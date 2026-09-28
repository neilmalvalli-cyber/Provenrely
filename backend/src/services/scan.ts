import { getAddress, isAddress } from "ethers";
import type { Chain, FlagInfo } from "../lib/chain.js";
import type { Explorer, ExplorerTx } from "../lib/explorer.js";
import { reasonLabel } from "../lib/flag-reasons.js";
import { ApiError, isoNow, type ScanResult, type Verdict } from "../types.js";

/** How many distinct counterparties are checked against the registry per scan (bounds RPC calls). */
const MAX_COUNTERPARTIES = 40;
const CONCURRENCY = 8;
const BURST_WINDOW_S = 600;
const BURST_MIN_WALLETS = 10;

export const verdictFor = (score: number): Verdict => (score >= 70 ? "HIGH_RISK" : score >= 35 ? "SUSPICIOUS" : "SAFE");

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/** Largest number of distinct recipients of outgoing transfers within any 10-minute window. */
export function maxBurst(outgoing: ExplorerTx[]): number {
  const txs = [...outgoing].sort((a, b) => a.timeStamp - b.timeStamp);
  let best = 0;
  let start = 0;
  for (let end = 0; end < txs.length; end++) {
    while (txs[end]!.timeStamp - txs[start]!.timeStamp > BURST_WINDOW_S) start++;
    best = Math.max(best, new Set(txs.slice(start, end + 1).map((t) => t.to)).size);
  }
  return best;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Risk verdict for an address from what MST can show: its own flag in the registry, links to
 * flagged counterparties in its recent history (MSTScan), and bursts of transfers to many wallets.
 * A missing data source is noted in the reasons instead of failing the scan.
 */
export async function scanAddress(rawAddress: unknown, deps: { chain: Chain; explorer: Explorer }): Promise<ScanResult> {
  if (typeof rawAddress !== "string" || !isAddress(rawAddress.trim())) {
    throw new ApiError(400, "Enter a valid address: 0x followed by 40 hex characters.");
  }
  const address = getAddress(rawAddress.trim());
  const self = address.toLowerCase();
  const { chain, explorer } = deps;
  const risks: string[] = [];
  const notes: string[] = [];
  let score = 5;

  const flagOf = async (a: string): Promise<FlagInfo | null> => {
    try {
      return await chain.getFlag(a);
    } catch (e) {
      console.warn("[scan] getFlag failed:", e instanceof Error ? e.message : e);
      return null;
    }
  };

  // 1. The address's own flag.
  if (chain.configured) {
    const own = await flagOf(address);
    if (own?.active) {
      score = 95;
      risks.push(`This address is flagged on the registry (${reasonLabel(own.reason)}).`);
    } else if (own === null) notes.push("The flag registry couldn't be reached, so this address's own flag wasn't checked.");
  } else notes.push("The flag registry isn't configured on this server, so flags weren't checked.");

  // 2. Recent history: links to flagged counterparties, and transfer bursts.
  const txs = await explorer.recentTransactions(address);
  if (txs === null) notes.push("Transaction history is unavailable right now, so only the flag registry was checked.");
  else if (txs.length === 0) notes.push("No transactions on MST yet.");
  else {
    const ok = txs.filter((t) => !t.isError);
    const incomingFrom = new Set(ok.filter((t) => t.to === self && t.from && t.from !== self).map((t) => t.from));
    const outgoing = ok.filter((t) => t.from === self && t.to && t.to !== self);
    const outgoingTo = new Set(outgoing.map((t) => t.to));

    if (chain.configured) {
      const counterparties = [...new Set([...incomingFrom, ...outgoingTo])].slice(0, MAX_COUNTERPARTIES);
      const flags = await mapLimit(counterparties, CONCURRENCY, flagOf);
      const flagged = new Set(counterparties.filter((_, i) => flags[i]?.active));
      const fromFlagged = [...incomingFrom].filter((a) => flagged.has(a)).length;
      const toFlagged = [...outgoingTo].filter((a) => flagged.has(a)).length;
      if (fromFlagged > 0) {
        score += 40 + 10 * Math.min(fromFlagged - 1, 3);
        risks.push(`Received funds from ${plural(fromFlagged, "flagged address", "flagged addresses")}.`);
      }
      if (toFlagged > 0) {
        score += 25;
        risks.push(`Sent funds to ${plural(toFlagged, "flagged address", "flagged addresses")}.`);
      }
    }

    const burst = maxBurst(outgoing);
    if (burst >= BURST_MIN_WALLETS) {
      score += 20;
      risks.push(`Sent to ${burst} different wallets within 10 minutes.`);
    }
    if (risks.length === 0) notes.push(`Checked the last ${plural(txs.length, "transaction", "transactions")}: no links to flagged addresses.`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { address, verdict: verdictFor(score), score, reasons: [...risks, ...notes], scannedAt: isoNow() };
}
