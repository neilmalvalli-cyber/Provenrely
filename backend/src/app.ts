import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Chain } from "./lib/chain.js";
import type { Explorer } from "./lib/explorer.js";
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
}

type Handler = (req: Request, res: Response) => Promise<unknown>;
const route = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/** The HTTP API described in backend/README.md. Errors are always `{ "error": "…" }`. */
export function createApp(deps: AppDeps) {
  const app = express();
  const stats = createStats(deps.chain);

  app.disable("x-powered-by");
  app.use(cors({ origin: deps.corsOrigins }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", registry: deps.chain.configured, anchoring: deps.chain.canWrite });
  });

  app.post("/api/scan", route(async (req, res) => res.json(await scanAddress(req.body?.address, deps))));
  app.post("/api/explain", route(async (req, res) => res.json(explain(parseExplainRequest(req.body)))));
  app.post("/api/certificates", route(async (req, res) => res.status(201).json(await createCertificate(req.body, deps))));
  app.get("/api/certificates/:id", route(async (req, res) => res.json(getCertificate(String(req.params.id), deps.store))));
  app.post("/api/certificates/:id/custody", route(async (req, res) => res.json(await logCustody(String(req.params.id), req.body, deps))));
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
