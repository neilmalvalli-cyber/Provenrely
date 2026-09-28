import cors from "cors";
import { formatEther } from "ethers";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Chain } from "./lib/chain.js";
import type { Explorer } from "./lib/explorer.js";
import { rateLimit, type Limit } from "./lib/rate-limit.js";
import { createCertificate, getCertificate, logCustody } from "./services/certificates.js";
import { explain, parseExplainRequest } from "./services/explain.js";
import { scanAddress } from "./services/scan.js";
import { createStats } from "./services/stats.js";
import type { CertificateStore } from "./store.js";
import { ApiError } from "./types.js";

export interface AppDeps {
  chain: Chain;
  explorer: Explorer;
  store: CertificateStore;
  issuerName: string;
  corsOrigins: string[];
  relayerMinBalance?: bigint;
  trustProxy?: number;
  limits?: Partial<Record<"certificates" | "custody" | "scan" | "explain", Limit>>;
  logs?: { startBlock: number; chunkSize: number; maxChunksPerRefresh: number; retries?: number; backoffMs?: number };
}

const DEFAULT_LIMITS = {
  certificates: { max: 5, windowMs: 3_600_000 },
  custody: { max: 20, windowMs: 3_600_000 },
  scan: { max: 30, windowMs: 60_000 },
  explain: { max: 30, windowMs: 60_000 },
};

type Handler = (req: Request, res: Response) => Promise<unknown>;
const route = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/** The HTTP API described in backend/README.md. Errors are always `{ "error": "…" }`. */
export function createApp(deps: AppDeps) {
  const app = express();
  const limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const certDeps = { ...deps, relayerMinBalance: deps.relayerMinBalance ?? 10n ** 16n };
  const stats = createStats(deps.chain, deps.logs ?? { startBlock: 0, chunkSize: 2000, maxChunksPerRefresh: 200 });

  app.disable("x-powered-by");
  app.set("trust proxy", deps.trustProxy ?? 0);
  app.use(cors({ origin: deps.corsOrigins, exposedHeaders: ["Retry-After"] }));
  app.use(express.json({ limit: "32kb" }));

  const health = route(async (_req, res) => {
    let relayer: { address: string; balance: string; low: boolean } | null = null;
    try {
      const r = await deps.chain.relayer();
      if (r) relayer = { address: r.address, balance: formatEther(r.balance), low: r.balance < certDeps.relayerMinBalance };
    } catch {
      /* balance unavailable — reported as null */
    }
    res.json({ status: "ok", registry: deps.chain.configured, anchoring: deps.chain.canWrite, relayer });
  });
  app.get("/api/health", health);
  app.get("/health", health);

  app.post("/api/scan", rateLimit("scan", limits.scan), route(async (req, res) => res.json(await scanAddress(req.body?.address, deps))));
  app.post("/api/explain", rateLimit("explain", limits.explain), route(async (req, res) => res.json(explain(parseExplainRequest(req.body)))));
  app.post(
    "/api/certificates",
    rateLimit("certificate", limits.certificates),
    route(async (req, res) => res.status(201).json(await createCertificate(req.body, certDeps))),
  );
  app.get("/api/certificates/:id", route(async (req, res) => res.json(getCertificate(String(req.params.id), deps.store))));
  app.post(
    "/api/certificates/:id/custody",
    rateLimit("custody", limits.custody),
    route(async (req, res) => res.json(await logCustody(String(req.params.id), req.body, certDeps))),
  );
  app.get("/api/stats", route(async (_req, res) => res.json(await stats())));

  app.use((_req, res) => res.status(404).json({ error: "Not found." }));

  // Known errors keep their message; anything else is logged and reported generically.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
    if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "The request body isn't valid JSON." });
    console.error("[api] unexpected error:", err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });

  return app;
}
