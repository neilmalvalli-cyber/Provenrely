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

export type RegistryEvent = "Flagged" | "CertificateAnchored";

/** Everything the API needs from MST. `configured` = registry reads work; `canWrite` = a relayer key is set. */
export interface Chain {
  readonly configured: boolean;
  readonly canWrite: boolean;
  getFlag(address: string): Promise<FlagInfo>;
  anchor(certHash: Hex, subject: string): Promise<CertificateAnchor>;
  logCustody(certHash: Hex, action: 1 | 2): Promise<{ txHash: Hex; timestamp: string }>;
  latestBlock(): Promise<number>;
  /** Number of `eventName` logs in [fromBlock, toBlock] — callers keep ranges small (MST limits log queries). */
  countEvents(eventName: RegistryEvent, fromBlock: number, toBlock: number): Promise<number>;
  /** The relayer wallet and its balance in wei; null without a relayer key. */
  relayer(): Promise<{ address: string; balance: bigint } | null>;
}

const notConfigured = (what: string) => async (): Promise<never> => {
  throw new ApiError(503, `${what} isn't configured on this server.`);
};

/** Used when REGISTRY_ADDRESS is unset: reads report "not configured", writes are refused. */
export const nullChain: Chain = {
  configured: false,
  canWrite: false,
  getFlag: notConfigured("The flag registry"),
  anchor: notConfigured("Anchoring"),
  logCustody: notConfigured("Custody logging"),
  latestBlock: notConfigured("The chain"),
  countEvents: notConfigured("The flag registry"),
  relayer: async () => null,
};

export function createChain(config: Config): Chain {
  if (!config.registryAddress) return nullChain;
  const provider = new JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true });
  const reader = new Contract(config.registryAddress, registryAbi, provider);
  const wallet = config.relayerKey ? new Wallet(config.relayerKey, provider) : null;
  const signer = wallet ? new NonceManager(wallet) : null;
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
    latestBlock: () => provider.getBlockNumber(),
    async countEvents(eventName, fromBlock, toBlock) {
      const logs = await reader.queryFilter(reader.filters[eventName]!(), fromBlock, toBlock);
      return logs.filter((l: Log | EventLog) => !l.removed).length;
    },
    async relayer() {
      if (!wallet) return null;
      return { address: wallet.address, balance: await provider.getBalance(wallet.address) };
    },
  };
}
