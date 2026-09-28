import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";
import { certificateHash } from "../src/lib/canonical.js";
import { nullChain } from "../src/lib/chain.js";
import { memoryStore } from "../src/store.js";
import type { Certificate } from "../src/types.js";
import { addr, fakeChain, fakeExplorer, tx } from "./helpers.js";

const ME = addr(0xa11ce);
const SCAM = addr(0xbad);
const fake = fakeChain({ [SCAM]: 1 });
let base = "";
let close: () => void;

async function call(path: string, init?: { method?: string; body?: unknown; raw?: string }) {
  const res = await fetch(`${base}${path}`, {
    method: init?.method ?? (init?.body !== undefined || init?.raw !== undefined ? "POST" : "GET"),
    headers: { "Content-Type": "application/json" },
    body: init?.raw ?? (init?.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
  return { status: res.status, json: (await res.json()) as any };
}

before(async () => {
  const app = createApp({ chain: fake.chain, explorer: fakeExplorer([tx(SCAM, ME, 1000)]), store: memoryStore(), issuerName: "Provenrely", corsOrigins: ["http://localhost:3000"] });
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
after(() => close());

test("GET /health", async () => {
  const r = await call("/health");
  assert.deepEqual(r.json, { status: "ok", registry: true, anchoring: true });
});

test("POST /api/scan returns the contract shape", async () => {
  const r = await call("/api/scan", { body: { address: ME } });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.json).sort(), ["address", "reasons", "scannedAt", "score", "verdict"]);
  assert.equal(r.json.verdict, "SUSPICIOUS");
});

test("POST /api/scan with a bad address → 400 { error }", async () => {
  const r = await call("/api/scan", { body: { address: "nope" } });
  assert.equal(r.status, 400);
  assert.equal(typeof r.json.error, "string");
});

test("POST /api/explain (hi) — extra fields like scannedAt are ignored", async () => {
  const r = await call("/api/explain", { body: { address: ME, verdict: "HIGH_RISK", score: 87, reasons: ["x"], language: "hi", scannedAt: "2026-09-29T00:00:00Z" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.language, "hi");
  assert.match(r.json.explanation, /87/);
  assert.ok(r.json.nextSteps.some((s: string) => s.includes("1930")));
  assert.ok(r.json.nextSteps.some((s: string) => s.includes("cybercrime.gov.in")));
});

test("POST /api/explain validates input", async () => {
  assert.equal((await call("/api/explain", { body: { verdict: "MAYBE", score: 1 } })).status, 400);
  assert.equal((await call("/api/explain", { body: { verdict: "SAFE", score: 1.5 } })).status, 400);
  assert.equal((await call("/api/explain", { body: { verdict: "SAFE", score: 10, language: "fr" } })).status, 400);
});

test("certificate: create → anchored hash matches body+salt → get → custody", async () => {
  const created = await call("/api/certificates", { body: { address: ME, language: "en" } });
  assert.equal(created.status, 201);
  const cert = created.json as Certificate;
  assert.match(cert.id, /^cert_[0-9a-f]{32}$/);
  assert.match(cert.salt, /^[0-9a-f]{64}$/);
  assert.equal(cert.body.schemaVersion, 1);
  assert.equal(cert.body.issuer, "Provenrely");
  assert.equal(cert.body.language, "en");
  // the anchored hash is exactly what the browser will recompute
  assert.equal(cert.anchor!.certHash, certificateHash(cert.body, cert.salt));
  assert.deepEqual(fake.anchors.at(-1), { certHash: cert.anchor!.certHash, subject: cert.body.address });

  const fetched = await call(`/api/certificates/${cert.id}`);
  assert.deepEqual(fetched.json, cert);

  const custody = await call(`/api/certificates/${cert.id}/custody`, { body: { action: "export" } });
  assert.equal(custody.status, 200);
  assert.deepEqual(Object.keys(custody.json).sort(), ["action", "certHash", "timestamp", "txHash"]);
  assert.equal(custody.json.action, "export");
  assert.deepEqual(fake.custody.at(-1), { certHash: cert.anchor!.certHash, action: 2 });
});

test("unknown certificate → 404, bad custody action → 400", async () => {
  assert.equal((await call("/api/certificates/cert_missing")).status, 404);
  const created = (await call("/api/certificates", { body: { address: ME } })).json as Certificate;
  assert.equal((await call(`/api/certificates/${created.id}/custody`, { body: { action: "delete" } })).status, 400);
});

test("GET /api/stats — real counts, transfersBlocked null", async () => {
  const r = await call("/api/stats");
  assert.equal(r.status, 200);
  assert.equal(r.json.flagsIssued, 1);
  assert.equal(typeof r.json.certificatesAnchored, "number");
  assert.equal(r.json.transfersBlocked, null);
  assert.match(r.json.updatedAt, /Z$/);
});

test("invalid JSON → 400 { error }, unknown route → 404 { error }", async () => {
  const bad = await call("/api/scan", { raw: "{not json" });
  assert.equal(bad.status, 400);
  assert.equal(typeof bad.json.error, "string");
  assert.equal((await call("/api/nope")).status, 404);
});

test("without a relayer: certificates are stored unanchored and custody is refused (409)", async () => {
  const app = createApp({ chain: { ...fakeChain({}, { canWrite: false }).chain }, explorer: fakeExplorer([]), store: memoryStore(), issuerName: "Provenrely", corsOrigins: [] });
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const cert = (await (await fetch(`${url}/api/certificates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: ME }) })).json()) as Certificate;
    assert.equal(cert.anchor, undefined);
    const res = await fetch(`${url}/api/certificates/${cert.id}/custody`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "share" }) });
    assert.equal(res.status, 409);
  } finally {
    server.close();
  }
});

test("with no registry at all, stats are null and scans still work", async () => {
  const app = createApp({ chain: nullChain, explorer: fakeExplorer(null), store: memoryStore(), issuerName: "Provenrely", corsOrigins: [] });
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const stats = (await (await fetch(`${url}/api/stats`)).json()) as Record<string, unknown>;
    assert.equal(stats.flagsIssued, null);
    assert.equal(stats.certificatesAnchored, null);
    const scan = await fetch(`${url}/api/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: ME }) });
    assert.equal(scan.status, 200);
  } finally {
    server.close();
  }
});
