import type { Chain, FlagInfo } from "../src/lib/chain.js";
import type { Explorer, ExplorerTx } from "../src/lib/explorer.js";
import type { CertificateAnchor, Hex } from "../src/types.js";

const NO_FLAG: FlagInfo = { active: false, issuer: "0x0000000000000000000000000000000000000000", reason: 0, expiry: 0n };

/** In-memory chain: flagged addresses (lowercase) → reason code; records anchors and custody calls. */
export function fakeChain(flagged: Record<string, number> = {}, opts: { canWrite?: boolean } = {}) {
  const anchors: { certHash: Hex; subject: string }[] = [];
  const custody: { certHash: Hex; action: number }[] = [];
  let n = 0;
  const tx = () => `0x${(++n).toString(16).padStart(64, "0")}` as Hex;
  const chain: Chain = {
    configured: true,
    canWrite: opts.canWrite ?? true,
    getFlag: async (a) => {
      const reason = flagged[a.toLowerCase()];
      return reason === undefined ? NO_FLAG : { active: true, issuer: "0x00000000000000000000000000000000000000ee", reason, expiry: 0n };
    },
    anchor: async (certHash, subject): Promise<CertificateAnchor> => {
      anchors.push({ certHash, subject });
      return { certHash, txHash: tx(), blockNumber: 100 + anchors.length, blockTimestamp: "2026-09-29T10:00:00Z" };
    },
    logCustody: async (certHash, action) => {
      custody.push({ certHash, action });
      return { txHash: tx(), timestamp: "2026-09-29T10:05:00Z" };
    },
    counts: async () => ({ flagsIssued: Object.keys(flagged).length, certificatesAnchored: anchors.length }),
  };
  return { chain, anchors, custody };
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
