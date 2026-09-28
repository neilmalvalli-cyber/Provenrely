import { Contract, JsonRpcProvider, NonceManager, Wallet, type ContractTransactionResponse, type EventLog, type Log } from "ethers";
import registryAbi from "../abi/ProvenrelyRegistry.json" with { type: "json" };
import type { Config } from "../config.js";
import { ApiError, isoFromUnix, type CertificateAnchor, type Hex } from "../types.js";

export interface FlagInfo {
  active: boolean;
  issuer: string;
  reason: number;
  expiry: bigint;
}

/** Everything the API needs from MST. `configured` = registry reads work; `canWrite` = a relayer key is set. */
export interface Chain {
  readonly configured: boolean;
  readonly canWrite: boolean;
  getFlag(address: string): Promise<FlagInfo>;
  anchor(certHash: Hex, subject: string): Promise<CertificateAnchor>;
  logCustody(certHash: Hex, action: 1 | 2): Promise<{ txHash: Hex; timestamp: string }>;
  counts(): Promise<{ flagsIssued: number; certificatesAnchored: number }>;
}

/** Used when REGISTRY_ADDRESS is unset: reads report "not configured", writes are refused. */
export const nullChain: Chain = {
  configured: false,
  canWrite: false,
  getFlag: async () => {
    throw new ApiError(503, "The flag registry isn't configured on this server.");
  },
  anchor: async () => {
    throw new ApiError(503, "Anchoring isn't configured on this server.");
  },
  logCustody: async () => {
    throw new ApiError(503, "Custody logging isn't configured on this server.");
  },
  counts: async () => {
    throw new ApiError(503, "The flag registry isn't configured on this server.");
  },
};

const CHUNK = 50_000;
const MAX_LOOKBACK = 2_000_000;

export function createChain(config: Config): Chain {
  if (!config.registryAddress) return nullChain;
  const provider = new JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true });
  const reader = new Contract(config.registryAddress, registryAbi, provider);
  const signer = config.relayerKey ? new NonceManager(new Wallet(config.relayerKey, provider)) : null;
  const writer = signer ? (reader.connect(signer) as Contract) : null;
  const overrides = config.legacyTx ? { type: 0 } : {};

  async function send(label: string, call: () => Promise<ContractTransactionResponse>) {
    if (!writer) throw new ApiError(503, `${label} isn't configured on this server (no relayer key).`);
    let receipt;
    try {
      const tx = await call();
      receipt = await tx.wait();
    } catch (e) {
      console.error(`[chain] ${label} failed:`, e);
      signer?.reset(); // resync the nonce after a failed send
      throw new ApiError(502, `${label} failed on MST. Try again in a moment.`);
    }
    if (!receipt || receipt.status !== 1) throw new ApiError(502, `${label} reverted on MST.`);
    const block = await provider.getBlock(receipt.blockNumber);
    return { receipt, timestamp: isoFromUnix(block?.timestamp ?? Math.floor(Date.now() / 1000)) };
  }

  /** Count every log of one event: full range first, then chunked backwards if the RPC limits ranges. */
  async function countEvents(eventName: string): Promise<number> {
    const filter = reader.filters[eventName]!();
    try {
      return (await reader.queryFilter(filter, 0, "latest")).length;
    } catch {
      const latest = await provider.getBlockNumber();
      const floor = Math.max(0, latest - MAX_LOOKBACK);
      let n = 0;
      for (let to = latest; to >= floor; to -= CHUNK) {
        const from = Math.max(floor, to - CHUNK + 1);
        n += (await reader.queryFilter(filter, from, to)).filter((l: Log | EventLog) => !l.removed).length;
        if (from === floor) break;
      }
      return n;
    }
  }

  return {
    configured: true,
    canWrite: writer !== null,
    async getFlag(address) {
      const [f, active] = (await reader.getFunction("getFlag")(address)) as [{ issuer: string; reason: bigint; expiry: bigint }, boolean];
      return { active, issuer: f.issuer, reason: Number(f.reason), expiry: f.expiry };
    },
    async anchor(certHash, subject) {
      const { receipt, timestamp } = await send("Anchoring", () => writer!.getFunction("anchorCertificate")(certHash, subject, overrides));
      return { certHash, txHash: receipt.hash as Hex, blockNumber: receipt.blockNumber, blockTimestamp: timestamp };
    },
    async logCustody(certHash, action) {
      const { receipt, timestamp } = await send("Custody logging", () => writer!.getFunction("logCustody")(certHash, action, overrides));
      return { txHash: receipt.hash as Hex, timestamp };
    },
    async counts() {
      const [flagsIssued, certificatesAnchored] = await Promise.all([countEvents("Flagged"), countEvents("CertificateAnchored")]);
      return { flagsIssued, certificatesAnchored };
    },
  };
}
