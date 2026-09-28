import type { Chain, FlagInfo } from "../src/lib/chain.js";
import type { Explorer, ExplorerTx } from "../src/lib/explorer.js";
import type { CertificateAnchor, Hex } from "../src/types.js";

const NO_FLAG: FlagInfo = { active: false, issuer: "0x0000000000000000000000000000000000000000", reason: 0, expiry: 0n };

/**
 * In-memory chain: flagged addresses (lowercase) → reason code, each Flagged event at block 1.
 * Each anchor/custody write mines one block. Records calls for assertions.
 */
export function fakeChain(flagged: Record<string, number> = {}, opts: { canWrite?: boolean; relayerBalance?: bigint } = {}) {
  const anchors: { certHash: Hex; subject: string; block: number }[] = [];
  const custody: { certHash: Hex; action: number }[] = [];
  let block = 1;
  let n = 0;
  const tx = () => `0x${(++n).toString(16).padStart(64, "0")}` as Hex;
  const state = { relayerBalance: opts.relayerBalance ?? 10n ** 18n };
  /** Failed calls per block, for the RPC block-scan fallback. */
  const failedCalls = new Map<number, number>();
  const chain: Chain = {
    configured: true,
    canWrite: opts.canWrite ?? true,
    getFlag: async (a) => {
      const reason = flagged[a.toLowerCase()];
      return reason === undefined ? NO_FLAG : { active: true, issuer: "0x00000000000000000000000000000000000000ee", reason, expiry: 0n };
    },
    anchor: async (certHash, subject): Promise<CertificateAnchor> => {
      anchors.push({ certHash, subject, block: ++block });
      return { certHash, txHash: tx(), blockNumber: block, blockTimestamp: "2026-09-29T10:00:00Z" };
    },
    logCustody: async (certHash, action) => {
      custody.push({ certHash, action });
      block++;
      return { txHash: tx(), timestamp: "2026-09-29T10:05:00Z" };
    },
    latestBlock: async () => block,
    countEvents: async (name, from, to) =>
      name === "Flagged" ? (from <= 1 && 1 <= to ? Object.keys(flagged).length : 0) : anchors.filter((a) => a.block >= from && a.block <= to).length,
    relayer: async () => (opts.canWrite === false ? null : { address: "0x00000000000000000000000000000000000000Aa", balance: state.relayerBalance }),
    countFailedCalls: async (_to, _sel, from, to) => [...failedCalls].filter(([b]) => b >= from && b <= to).reduce((s, [, n]) => s + n, 0),
  };
  const mine = (n = 1) => (block += n);
  return { chain, anchors, custody, state, failedCalls, mine };
}

export const fakeExplorer = (txs: ExplorerTx[] | null): Explorer => ({ recentTransactions: async () => txs });

export const tx = (from: string, to: string, timeStamp: number, isError = false): ExplorerTx => ({
  from: from.toLowerCase(),
  to: to.toLowerCase(),
  value: "1000000000000000000",
  timeStamp,
  isError,
});

export const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
