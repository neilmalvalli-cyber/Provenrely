import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp, type AppDeps } from "../src/app.js";
import { createIncrementalCounter, withRetry } from "../src/lib/incremental.js";
import { parseLimit } from "../src/lib/rate-limit.js";
import { memoryStore } from "../src/store.js";
import { addr, fakeChain, fakeExplorer } from "./helpers.js";

const ME = addr(0xa11ce);

async function serve(overrides: Partial<AppDeps> = {}) {
  const app = createApp({ chain: fakeChain().chain, explorer: fakeExplorer([]), store: memoryStore(), issuerName: "Provenrely", corsOrigins: [], ...overrides });
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { base, post, close: () => server.close() };
}

test("rate limit: certificates → 429 with Retry-After in the { error } format", async () => {
  const s = await serve({ limits: { certificates: { max: 2, windowMs: 60_000 } } });
  try {
    assert.equal((await s.post("/api/certificates", { address: ME })).status, 201);
    assert.equal((await s.post("/api/certificates", { address: ME })).status, 201);
    const third = await s.post("/api/certificates", { address: ME });
    assert.equal(third.status, 429);
    assert.ok(Number(third.headers.get("retry-after")) > 0);
    assert.match(((await third.json()) as { error: string }).error, /Too many certificate requests/);
    // other endpoints have their own budget
    assert.equal((await s.post("/api/scan", { address: ME })).status, 200);
  } finally {
    s.close();
  }
});

test("rate limit: custody, scan and explain are limited too", async () => {
  const s = await serve({ limits: { custody: { max: 1, windowMs: 60_000 }, scan: { max: 1, windowMs: 60_000 }, explain: { max: 1, windowMs: 60_000 } } });
  try {
    const cert = (await (await s.post("/api/certificates", { address: ME })).json()) as { id: string };
    assert.equal((await s.post(`/api/certificates/${cert.id}/custody`, { action: "share" })).status, 200);
    assert.equal((await s.post(`/api/certificates/${cert.id}/custody`, { action: "share" })).status, 429);
    assert.equal((await s.post("/api/scan", { address: ME })).status, 200);
    assert.equal((await s.post("/api/scan", { address: ME })).status, 429);
    const ex = { verdict: "SAFE", score: 5, language: "en" };
    assert.equal((await s.post("/api/explain", ex)).status, 200);
    assert.equal((await s.post("/api/explain", ex)).status, 429);
  } finally {
    s.close();
  }
});

test("parseLimit reads 'max/seconds' and falls back on bad input", () => {
  assert.deepEqual(parseLimit("5/3600", { max: 1, windowMs: 1 }), { max: 5, windowMs: 3_600_000 });
  assert.deepEqual(parseLimit("nonsense", { max: 1, windowMs: 1 }), { max: 1, windowMs: 1 });
});

test("low relayer balance: issuance refused up front (503), nothing anchored; health shows the balance", async () => {
  const fake = fakeChain({}, { relayerBalance: 10n ** 15n }); // 0.001 tMSTC
  const s = await serve({ chain: fake.chain, relayerMinBalance: 10n ** 16n });
  try {
    const res = await s.post("/api/certificates", { address: ME });
    assert.equal(res.status, 503);
    assert.match(((await res.json()) as { error: string }).error, /low on tMSTC/);
    assert.equal(fake.anchors.length, 0);

    const health = (await (await fetch(`${s.base}/api/health`)).json()) as { relayer: { balance: string; low: boolean } };
    assert.deepEqual(health.relayer, { address: "0x00000000000000000000000000000000000000Aa", balance: "0.001", low: true });

    fake.state.relayerBalance = 10n ** 18n;
    assert.equal((await s.post("/api/certificates", { address: ME })).status, 201);
  } finally {
    s.close();
  }
});

test("incremental counter: small chunks from the start block, only new blocks on refresh", async () => {
  const ranges: [number, number][] = [];
  const c = createIncrementalCounter(async (a, b) => (ranges.push([a, b]), b - a + 1), { startBlock: 100, chunkSize: 10, maxChunksPerRefresh: 50 });
  assert.equal(await c.refresh(124), 25);
  assert.deepEqual(ranges, [[100, 109], [110, 119], [120, 124]]);
  ranges.length = 0;
  assert.equal(await c.refresh(130), 31);
  assert.deepEqual(ranges, [[125, 130]]);
});

test("incremental counter: null while catching up, then the full total", async () => {
  const c = createIncrementalCounter(async (a, b) => b - a + 1, { startBlock: 0, chunkSize: 10, maxChunksPerRefresh: 2 });
  assert.equal(await c.refresh(49), null); // 20 of 50 blocks
  assert.equal(await c.refresh(49), null); // 40
  assert.equal(await c.refresh(49), 50);
});

test("incremental counter: a failing range is retried with backoff; persistent failure → null, progress kept", async () => {
  let calls = 0;
  const flaky = createIncrementalCounter(
    async (a, b) => {
      if (++calls < 3) throw new Error("query returned more than 10000 results");
      return b - a + 1;
    },
    { startBlock: 0, chunkSize: 100, maxChunksPerRefresh: 5, retries: 3, backoffMs: 1 },
  );
  assert.equal(await flaky.refresh(9), 10);
  assert.equal(calls, 3);

  let broken = true;
  const c = createIncrementalCounter(
    async (a, b) => {
      if (a >= 10 && broken) throw new Error("rpc down");
      return b - a + 1;
    },
    { startBlock: 0, chunkSize: 10, maxChunksPerRefresh: 10, retries: 1, backoffMs: 1 },
  );
  assert.equal(await c.refresh(19), null);
  assert.deepEqual(c.position, { next: 10, total: 10 });
  broken = false;
  assert.equal(await c.refresh(19), 20);
});

test("withRetry gives up after the last attempt", async () => {
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new Error("x"); }, 2, 1));
  assert.equal(n, 3);
});
