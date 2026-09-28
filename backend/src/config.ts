import { getAddress, isAddress, parseEther, parseUnits } from "ethers";
import { parseLimit, type Limit } from "./lib/rate-limit.js";

/** Runtime configuration from environment variables (see .env.example). Missing chain settings → "not configured" mode. */
export interface Config {
  port: number;
  corsOrigins: string[];
  /** Number of reverse proxies in front of the app (Render/Railway: 1), so req.ip is the client's IP. */
  trustProxy: number;
  dataDir: string;
  rpcUrl: string;
  chainId: number;
  registryAddress: string | null;
  safeSendAddress: string | null;
  /** Block the contracts were deployed in; log scans start here. */
  deployBlock: number;
  /** Blocks per log query (MST limits ranges) and max queries per stats refresh. */
  logChunkSize: number;
  maxChunksPerRefresh: number;
  /** Relayer key (holds RELAYER on the registry). Only read from the environment, never logged. */
  relayerKey: string | null;
  /** Below this balance (wei) certificate issuance is refused up front. */
  relayerMinBalance: bigint;
  /** MST uses legacy (type 0) transactions. */
  legacyTx: boolean;
  /** Floor for gas price / priority fee (wei). MST rejects anything below 1 gwei. */
  minGasPrice: bigint;
  explorerApiUrl: string | null;
  issuerName: string;
  limits: { certificates: Limit; custody: Limit; scan: Limit; explain: Limit };
}

const str = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

function address(name: string, v: string | undefined): string | null {
  const a = str(v);
  if (a && !isAddress(a)) throw new Error(`${name} is not a valid address`);
  return a ? getAddress(a) : null;
}

function int(name: string, v: string | undefined, fallback: number, min = 0): number {
  const n = v === undefined || v.trim() === "" ? fallback : Number(v);
  if (!Number.isSafeInteger(n) || n < min) throw new Error(`${name} must be an integer ≥ ${min}`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const key = str(env.RELAYER_PK);
  if (key && !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("RELAYER_PK must be 0x followed by 64 hex characters");

  return {
    port: int("PORT", env.PORT, 8000, 1),
    corsOrigins: (str(env.CORS_ORIGIN) ?? "http://localhost:3000").split(",").map((s) => s.trim()),
    trustProxy: int("TRUST_PROXY", env.TRUST_PROXY, 0),
    dataDir: str(env.DATA_DIR) ?? "./data",
    rpcUrl: str(env.MST_RPC_URL) ?? "https://testnetrpc.mstblockchain.com",
    chainId: int("MST_CHAIN_ID", env.MST_CHAIN_ID, 91562037, 1),
    registryAddress: address("REGISTRY_ADDRESS", env.REGISTRY_ADDRESS),
    safeSendAddress: address("SAFESEND_ADDRESS", env.SAFESEND_ADDRESS),
    deployBlock: int("DEPLOY_BLOCK", env.DEPLOY_BLOCK, 0),
    logChunkSize: int("LOG_CHUNK_SIZE", env.LOG_CHUNK_SIZE, 2000, 1),
    maxChunksPerRefresh: int("LOG_MAX_CHUNKS_PER_REFRESH", env.LOG_MAX_CHUNKS_PER_REFRESH, 200, 1),
    relayerKey: key,
    relayerMinBalance: parseEther(str(env.RELAYER_MIN_BALANCE) ?? "0.01"),
    legacyTx: (env.MST_LEGACY_TX ?? "true") !== "false",
    minGasPrice: parseUnits(str(env.MIN_GAS_PRICE_GWEI) ?? "1", "gwei"),
    // unset → MSTScan; set but empty → no explorer (e.g. a local Anvil chain)
    explorerApiUrl: env.EXPLORER_API_URL === undefined ? "https://testnet.mstscan.com/api" : str(env.EXPLORER_API_URL),
    issuerName: str(env.ISSUER_NAME) ?? "Provenrely",
    limits: {
      certificates: parseLimit(env.RATE_LIMIT_CERTIFICATES, { max: 5, windowMs: 3_600_000 }),
      custody: parseLimit(env.RATE_LIMIT_CUSTODY, { max: 20, windowMs: 3_600_000 }),
      scan: parseLimit(env.RATE_LIMIT_SCAN, { max: 30, windowMs: 60_000 }),
      explain: parseLimit(env.RATE_LIMIT_EXPLAIN, { max: 30, windowMs: 60_000 }),
    },
  };
}
