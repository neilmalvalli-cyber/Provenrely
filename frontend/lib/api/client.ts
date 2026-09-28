import { env } from "@/lib/config/env";
import { mocks } from "./mocks";
import type { Certificate, CustodyAction, CustodyReceipt, ExplainRequest, Explanation, Language, ScanResult, Stats } from "./types";

/** Typed client for the Provenrely API. With NEXT_PUBLIC_USE_MOCKS=true every call returns sample data. */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  if (!env.apiUrl) throw new ApiError("The API URL is not configured (NEXT_PUBLIC_API_URL).");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${env.apiUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
      throw new ApiError(msg, res.status);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") throw new ApiError("The API took too long to respond. Try again.");
    throw new ApiError("Couldn't reach the API. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  scan: (address: string): Promise<ScanResult> => (env.useMocks ? mocks.scan(address) : request("/api/scan", { method: "POST", body: { address } })),
  explain: (req: ExplainRequest): Promise<Explanation> => (env.useMocks ? mocks.explain(req) : request("/api/explain", { method: "POST", body: req })),
  createCertificate: (input: { address: string; language: Language }): Promise<Certificate> =>
    env.useMocks ? mocks.createCertificate(input) : request("/api/certificates", { method: "POST", body: input }),
  getCertificate: (id: string): Promise<Certificate> =>
    env.useMocks ? mocks.getCertificate(id) : request(`/api/certificates/${encodeURIComponent(id)}`),
  logCustody: (id: string, action: CustodyAction): Promise<CustodyReceipt> =>
    env.useMocks ? mocks.logCustody(id, action) : request(`/api/certificates/${encodeURIComponent(id)}/custody`, { method: "POST", body: { action } }),
  stats: (): Promise<Stats> => (env.useMocks ? mocks.stats() : request("/api/stats")),
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");
