/** Recent transactions for an address from MSTScan's Etherscan-compatible API (Blockscout `module=account&action=txlist`). */

export interface ExplorerTx {
  from: string;
  to: string;
  /** wei, decimal string */
  value: string;
  /** seconds since epoch */
  timeStamp: number;
  isError: boolean;
}

export interface Explorer {
  /** Newest first. `null` when the explorer can't be reached — callers must degrade, not fail. */
  recentTransactions(address: string, limit?: number): Promise<ExplorerTx[] | null>;
}

export const nullExplorer: Explorer = { recentTransactions: async () => null };

export function createExplorer(apiUrl: string | null, timeoutMs = 10_000): Explorer {
  if (!apiUrl) return nullExplorer;
  return {
    async recentTransactions(address, limit = 200) {
      const url = `${apiUrl}?module=account&action=txlist&address=${address}&page=1&offset=${limit}&sort=desc`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return null;
        const data = (await res.json()) as { status?: string; message?: string; result?: unknown };
        if (!Array.isArray(data.result)) return /no transactions/i.test(data.message ?? "") ? [] : null;
        return (data.result as Record<string, string>[]).map((t) => ({
          from: (t.from ?? "").toLowerCase(),
          to: (t.to ?? "").toLowerCase(),
          value: t.value ?? "0",
          timeStamp: Number(t.timeStamp ?? 0),
          isError: t.isError === "1",
        }));
      } catch (e) {
        console.warn("[explorer] txlist failed:", e instanceof Error ? e.message : e);
        return null;
      }
    },
  };
}
