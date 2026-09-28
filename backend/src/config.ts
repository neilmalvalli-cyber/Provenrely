import { getAddress, isAddress } from "ethers";

/** Runtime configuration from environment variables (see .env.example). Missing chain settings → "not configured" mode. */
export interface Config {
  port: number;
  corsOrigins: string[];
  dataDir: string;
  rpcUrl: string;
  chainId: number;
  registryAddress: string | null;
  /** Relayer key (holds RELAYER on the registry). Only read from the environment, never logged. */
  relayerKey: string | null;
  /** MST uses legacy (type 0) transactions. */
  legacyTx: boolean;
  explorerApiUrl: string | null;
  issuerName: string;
}

const str = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const registry = str(env.REGISTRY_ADDRESS);
  if (registry && !isAddress(registry)) throw new Error("REGISTRY_ADDRESS is not a valid address");
  const key = str(env.RELAYER_PK);
  if (key && !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("RELAYER_PK must be 0x followed by 64 hex characters");
  const chainId = Number(env.MST_CHAIN_ID ?? 91562037);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("MST_CHAIN_ID must be a positive integer");

  return {
    port: Number(env.PORT ?? 8000),
    corsOrigins: (str(env.CORS_ORIGIN) ?? "http://localhost:3000").split(",").map((s) => s.trim()),
    dataDir: str(env.DATA_DIR) ?? "./data",
    rpcUrl: str(env.MST_RPC_URL) ?? "https://testnetrpc.mstblockchain.com",
    chainId,
    registryAddress: registry ? getAddress(registry) : null,
    relayerKey: key,
    legacyTx: (env.MST_LEGACY_TX ?? "true") !== "false",
    // unset → MSTScan; set but empty → no explorer (e.g. a local Anvil chain)
    explorerApiUrl: env.EXPLORER_API_URL === undefined ? "https://testnet.mstscan.com/api" : str(env.EXPLORER_API_URL),
    issuerName: str(env.ISSUER_NAME) ?? "Provenrely",
  };
}
