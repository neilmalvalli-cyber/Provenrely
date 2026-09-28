import { zeroHash, type Address, type Hex, type PublicClient } from "viem";
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

/** Seconds since epoch when the hash was anchored; 0 = never anchored. One view call: certificates(hash).timestamp. */
export async function readAnchoredAt(client: PublicClient, certHash: Hex): Promise<bigint> {
  const [, timestamp] = await client.readContract({ ...registry, functionName: "certificates", args: [certHash] });
  return timestamp;
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
    const a = l.args as { actor: Address; action: number; ts: bigint };
    return { actor: a.actor, action: a.action, timestamp: a.ts, txHash: l.transactionHash, blockNumber: l.blockNumber };
  });
}

/** The ISSUER role id never changes for a deployed registry, so it is read once and cached. */
let issuerRole: Promise<Hex> | null = null;

export type Roles = { issuer: boolean; admin: boolean };

/**
 * The wallet's AccessControl roles: hasRole(ISSUER(), account) and hasRole(DEFAULT_ADMIN_ROLE, account).
 * Issuers can flag; the contract lets a flag's own issuer or an admin revoke it.
 */
export async function readRoles(client: PublicClient, account: Address): Promise<Roles> {
  issuerRole ??= client.readContract({ ...registry, functionName: "ISSUER" }).catch((e: unknown) => {
    issuerRole = null;
    throw e;
  });
  const [issuer, admin] = await Promise.all([
    client.readContract({ ...registry, functionName: "hasRole", args: [await issuerRole, account] }),
    client.readContract({ ...registry, functionName: "hasRole", args: [zeroHash, account] }), // DEFAULT_ADMIN_ROLE = 0x00…00
  ]);
  return { issuer, admin };
}

export type FlagRecord = { issuer: Address; reason: number; evidenceHash: Hex; expiry: bigint; revoked: boolean; active: boolean };

/** getFlag(subject) → the stored flag plus the contract's own `active` verdict (exists, not revoked, not expired). */
export async function readFlag(client: PublicClient, subject: Address): Promise<FlagRecord> {
  const [f, active] = await client.readContract({ ...registry, functionName: "getFlag", args: [subject] });
  return { ...f, active };
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
