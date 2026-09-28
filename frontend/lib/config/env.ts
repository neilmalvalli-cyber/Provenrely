import { getAddress, isAddress, type Address } from "viem";

/**
 * Public configuration, read from NEXT_PUBLIC_* variables. Each one is written out literally:
 * Next.js inlines them into the browser bundle at build time and cannot inline dynamic lookups.
 * Nothing here is a guess — a missing value becomes a visible "not configured" state.
 */

const rawChainId = process.env.NEXT_PUBLIC_MST_CHAIN_ID;
const rawRpc = process.env.NEXT_PUBLIC_MST_RPC_URL;
const rawExplorer = process.env.NEXT_PUBLIC_MST_EXPLORER_URL;
const rawRegistry = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
const rawSafeSend = process.env.NEXT_PUBLIC_SAFESEND_ADDRESS;
const rawApi = process.env.NEXT_PUBLIC_API_URL;
const rawMocks = process.env.NEXT_PUBLIC_USE_MOCKS;

const trimSlash = (url: string) => url.replace(/\/+$/, "");

function parseChainId(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function parseAddress(value: string | undefined): Address | null {
  const v = value?.trim();
  return v && isAddress(v) ? getAddress(v) : null;
}

export const env = {
  /** MST Testnet chain id; null when unset or invalid (chain features show "not configured"). */
  chainId: parseChainId(rawChainId),
  rpcUrl: trimSlash(rawRpc?.trim() || "https://testnetrpc.mstblockchain.com"),
  explorerUrl: trimSlash(rawExplorer?.trim() || "https://testnet.mstscan.com"),
  registryAddress: parseAddress(rawRegistry),
  safeSendAddress: parseAddress(rawSafeSend),
  apiUrl: rawApi?.trim() ? trimSlash(rawApi.trim()) : null,
  /** Sample data for every API call, always labelled as such in the UI. */
  useMocks: rawMocks === "true",
} as const;

/** Human-readable list of what is missing, for "not configured" states. */
export function configIssues(): string[] {
  const issues: string[] = [];
  if (env.chainId === null) issues.push("NEXT_PUBLIC_MST_CHAIN_ID is not set");
  if (!env.registryAddress) issues.push("NEXT_PUBLIC_REGISTRY_ADDRESS is not set");
  if (!env.safeSendAddress) issues.push("NEXT_PUBLIC_SAFESEND_ADDRESS is not set");
  if (!env.apiUrl && !env.useMocks) issues.push("NEXT_PUBLIC_API_URL is not set");
  return issues;
}
