/**
 * Counts something over a block range incrementally: scans [start, latest] in small chunks, keeps the
 * running total and where it stopped, and only scans new blocks on the next refresh. Each chunk is
 * retried with exponential backoff. MST's RPC limits log queries, so ranges stay small.
 */

export interface IncrementalOptions {
  /** First block to scan (the contracts' deploy block). */
  startBlock: number;
  /** Blocks per request. */
  chunkSize: number;
  /** Upper bound on requests per refresh, so one call never hangs for minutes while catching up. */
  maxChunksPerRefresh: number;
  retries?: number;
  backoffMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, backoffMs = 500): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(backoffMs * 2 ** attempt);
    }
  }
}

export function createIncrementalCounter(countRange: (from: number, to: number) => Promise<number>, opts: IncrementalOptions) {
  let next = opts.startBlock;
  let total = 0;
  let inFlight: Promise<number | null> | null = null;

  async function advance(latest: number): Promise<number | null> {
    for (let chunks = 0; next <= latest && chunks < opts.maxChunksPerRefresh; chunks++) {
      const to = Math.min(next + opts.chunkSize - 1, latest);
      const from = next;
      try {
        total += await withRetry(() => countRange(from, to), opts.retries ?? 3, opts.backoffMs ?? 500);
      } catch (e) {
        console.warn(`[counter] blocks ${from}–${to} failed after retries:`, e instanceof Error ? e.message : e);
        return null;
      }
      next = to + 1;
    }
    // Only report a number once caught up — a partial total would be misleading.
    return next > latest ? total : null;
  }

  return {
    /** Total up to `latest`, or null while still catching up / after a failure (progress is kept). */
    refresh(latest: number): Promise<number | null> {
      inFlight ??= advance(latest).finally(() => (inFlight = null));
      return inFlight;
    },
    get position() {
      return { next, total };
    },
  };
}
