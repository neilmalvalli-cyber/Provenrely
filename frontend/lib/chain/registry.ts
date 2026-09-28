import type { Address, Hex, PublicClient } from "viem";
import { registryAbi } from "@/abi/registry";
import { env } from "@/lib/config/env";
import { MST_CONFIGURED } from "./mst";

/** True when the chain and the registry address are both configured. */
export const REGISTRY_READY = MST_CONFIGURED && env.registryAddress !== null;

export const registry = { address: env.registryAddress as Address, abi: registryAbi } as const;

/** Block range per request when an RPC refuses a full-range log query. */
const CHUNK = 50_000n;
const MAX_LOOKBACK = 2_000_000n;

type EventName = "Flagged" | "Revoked" | "CertificateAnchored" | "CustodyLogged";

/** A mined, decoded registry log (pending logs, which have no tx hash yet, are dropped). */
type MinedLog = { args: Record<string, unknown>; transactionHash: Hex; blockNumber: bigint };
type RawLog = { args?: unknown; transactionHash: Hex | null; blockNumber: bigint | null };
type Query = Parameters<PublicClient["getContractEvents"]>[0];

const mined = (logs: readonly RawLog[]): MinedLog[] =>
  logs.flatMap((l) =>
    l.transactionHash && l.blockNumber !== null && l.args && typeof l.args === "object"
      ? [{ args: l.args as Record<string, unknown>, transactionHash: l.transactionHash, blockNumber: l.blockNumber }]
      : [],
  );

/**
 * Indexed event query. Tries the full range first (cheap with indexed topics); if the RPC refuses
 * (range limits), walks backwards in chunks from the latest block.
 */
async function events(client: PublicClient, eventName: EventName, args: Record<string, unknown>, fromBlock = 0n): Promise<MinedLog[]> {
  const base = { address: registry.address, abi: registryAbi, eventName, args, strict: true };
  const query = (from: bigint, to: bigint | "latest") => client.getContractEvents({ ...base, fromBlock: from, toBlock: to } as Query) as Promise<RawLog[]>;
  try {
    return mined(await query(fromBlock, "latest"));
  } catch {
    const latest = await client.getBlockNumber();
    const floor = fromBlock > latest - MAX_LOOKBACK ? fromBlock : latest - MAX_LOOKBACK > 0n ? latest - MAX_LOOKBACK : 0n;
    const out: MinedLog[] = [];
    for (let to = latest; to >= floor; to -= CHUNK) {
      const from = to - CHUNK + 1n > floor ? to - CHUNK + 1n : floor;
      out.unshift(...mined(await query(from, to)));
      if (from === floor) break;
    }
    return out;
  }
}

/** Seconds since epoch when the hash was anchored; 0 = never anchored. One fast view call. */
export async function readAnchoredAt(client: PublicClient, certHash: Hex): Promise<bigint> {
  return client.readContract({ ...registry, functionName: "anchoredAt", args: [certHash] });
}

export type AnchorEvent = { txHash: Hex; blockNumber: bigint; timestamp: bigint };

/** The single CertificateAnchored event for a hash — only needed for the tx link. */
export async function findAnchorEvent(client: PublicClient, certHash: Hex): Promise<AnchorEvent | null> {
  const logs = await events(client, "CertificateAnchored", { certHash });
  const log = logs[0];
  if (!log) return null;
  const a = log.args as { timestamp: bigint };
  return { txHash: log.transactionHash, blockNumber: log.blockNumber, timestamp: a.timestamp };
}

export type AnchoredEvent = { certHash: Hex; subject: Address; timestamp: bigint; txHash: Hex; blockNumber: bigint };

/** Every CertificateAnchored event (oldest first). */
export async function anchorEvents(client: PublicClient): Promise<AnchoredEvent[]> {
  const logs = await events(client, "CertificateAnchored", {});
  return logs.map((l) => ({ ...(l.args as Omit<AnchoredEvent, "txHash" | "blockNumber">), txHash: l.transactionHash, blockNumber: l.blockNumber }));
}

export type CustodyEvent = { actor: Address; action: number; timestamp: bigint; txHash: Hex; blockNumber: bigint };

export async function custodyEvents(client: PublicClient, certHash: Hex, fromBlock = 0n): Promise<CustodyEvent[]> {
  const logs = await events(client, "CustodyLogged", { certHash }, fromBlock);
  return logs.map((l) => {
    const a = l.args as { actor: Address; action: number; timestamp: bigint };
    return { actor: a.actor, action: a.action, timestamp: a.timestamp, txHash: l.transactionHash, blockNumber: l.blockNumber };
  });
}

/** ISSUER_ROLE never changes for a deployed registry, so it is read once and cached. */
let issuerRole: Promise<Hex> | null = null;

/** Whether `account` holds ISSUER_ROLE (OpenZeppelin AccessControl: ISSUER_ROLE() + hasRole()). */
export async function isIssuer(client: PublicClient, account: Address): Promise<boolean> {
  issuerRole ??= client.readContract({ ...registry, functionName: "ISSUER_ROLE" }).catch((e: unknown) => {
    issuerRole = null;
    throw e;
  });
  return client.readContract({ ...registry, functionName: "hasRole", args: [await issuerRole, account] });
}

export type FlagRecord = { issuer: Address; reason: number; evidenceHash: Hex; expiry: bigint; revoked: boolean };

export async function readFlag(client: PublicClient, subject: Address): Promise<FlagRecord> {
  return client.readContract({ ...registry, functionName: "getFlag", args: [subject] });
}

export type FlagEvent = { subject: Address; issuer: Address; reason: number; evidenceHash: Hex; expiry: bigint; txHash: Hex; blockNumber: bigint };
export type RevokeEvent = { subject: Address; by: Address; txHash: Hex; blockNumber: bigint };

export async function flagEvents(client: PublicClient, filter: { issuer?: Address } = {}): Promise<FlagEvent[]> {
  const logs = await events(client, "Flagged", filter.issuer ? { issuer: filter.issuer } : {});
  return logs.map((l) => ({ ...(l.args as Omit<FlagEvent, "txHash" | "blockNumber">), txHash: l.transactionHash, blockNumber: l.blockNumber }));
}

export async function revokeEvents(client: PublicClient): Promise<RevokeEvent[]> {
  const logs = await events(client, "Revoked", {});
  return logs.map((l) => ({ ...(l.args as Omit<RevokeEvent, "txHash" | "blockNumber">), txHash: l.transactionHash, blockNumber: l.blockNumber }));
}

/** Timestamps (seconds) → readable UTC. */
export const fromUnix = (s: bigint | number) => new Date(Number(s) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
