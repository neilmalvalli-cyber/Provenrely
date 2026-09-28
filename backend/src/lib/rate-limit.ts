import type { NextFunction, Request, Response } from "express";

export interface Limit {
  /** Requests allowed per window, per client IP. */
  max: number;
  windowMs: number;
}

/** "5/3600" → 5 requests per 3600 s. */
export function parseLimit(value: string | undefined, fallback: Limit): Limit {
  const m = value?.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  return m ? { max: Number(m[1]), windowMs: Number(m[2]) * 1000 } : fallback;
}

/**
 * Per-IP sliding-window limiter, in memory (one instance — use a shared store before scaling out).
 * Over the limit → 429 with Retry-After (seconds) and the usual `{ error }` body.
 */
export function rateLimit(name: string, limit: Limit, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  return (req: Request, res: Response, next: NextFunction) => {
    const t = now();
    const key = req.ip ?? "unknown";
    const recent = (hits.get(key) ?? []).filter((ts) => t - ts < limit.windowMs);

    if (recent.length >= limit.max) {
      const retryAfter = Math.max(1, Math.ceil((recent[0]! + limit.windowMs - t) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: `Too many ${name} requests. Try again in ${retryAfter} seconds.` });
      return;
    }
    recent.push(t);
    hits.set(key, recent);

    // Drop idle clients now and then so the map doesn't grow without bound.
    if (t - lastSweep > limit.windowMs) {
      for (const [k, v] of hits) if (v.every((ts) => t - ts >= limit.windowMs)) hits.delete(k);
      lastSweep = t;
    }
    next();
  };
}
