import assert from "node:assert/strict";
import { test } from "node:test";
import { nullChain } from "../src/lib/chain.js";
import { maxBurst, scanAddress, verdictFor } from "../src/services/scan.js";
import { ApiError } from "../src/types.js";
import { addr, fakeChain, fakeExplorer, tx } from "./helpers.js";

const ME = addr(0xa11ce);
const SCAM = addr(0xbad);

test("rejects an invalid address with 400", async () => {
  await assert.rejects(scanAddress("0x123", { chain: nullChain, explorer: fakeExplorer([]) }), (e) => e instanceof ApiError && e.status === 400);
});

test("a flagged address is HIGH_RISK with the flag reason", async () => {
  const r = await scanAddress(ME, { chain: fakeChain({ [ME]: 2 }).chain, explorer: fakeExplorer([]) });
  assert.equal(r.verdict, "HIGH_RISK");
  assert.equal(r.score, 95);
  assert.match(r.reasons[0]!, /flagged on the registry \(Investment scam\)/);
  assert.match(r.scannedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});

test("receiving from a flagged address is SUSPICIOUS", async () => {
  const r = await scanAddress(ME, { chain: fakeChain({ [SCAM]: 1 }).chain, explorer: fakeExplorer([tx(SCAM, ME, 1000)]) });
  assert.equal(r.verdict, "SUSPICIOUS");
  assert.equal(r.score, 45);
  assert.deepEqual(r.reasons, ["Received funds from 1 flagged address."]);
});

test("failed transactions don't count as links", async () => {
  const r = await scanAddress(ME, { chain: fakeChain({ [SCAM]: 1 }).chain, explorer: fakeExplorer([tx(SCAM, ME, 1000, true)]) });
  assert.equal(r.verdict, "SAFE");
});

test("received from and sent to flagged addresses + a transfer burst is HIGH_RISK", async () => {
  const burst = Array.from({ length: 12 }, (_, i) => tx(ME, addr(0x1000 + i), 5000 + i * 30));
  const r = await scanAddress(ME, {
    chain: fakeChain({ [SCAM]: 1, [addr(0x1000)]: 5 }).chain,
    explorer: fakeExplorer([tx(SCAM, ME, 1000), ...burst]),
  });
  assert.equal(r.verdict, "HIGH_RISK");
  assert.equal(r.score, 5 + 40 + 25 + 20);
  assert.equal(r.reasons.length, 3);
});

test("clean history is SAFE with a note on what was checked", async () => {
  const r = await scanAddress(ME, { chain: fakeChain().chain, explorer: fakeExplorer([tx(addr(1), ME, 1), tx(ME, addr(2), 2)]) });
  assert.equal(r.verdict, "SAFE");
  assert.deepEqual(r.reasons, ["Checked the last 2 transactions: no links to flagged addresses."]);
});

test("missing data sources are noted, not fatal", async () => {
  const r = await scanAddress(ME, { chain: nullChain, explorer: fakeExplorer(null) });
  assert.equal(r.verdict, "SAFE");
  assert.equal(r.reasons.length, 2);
  assert.match(r.reasons.join(" "), /isn't configured/);
  assert.match(r.reasons.join(" "), /unavailable/);
});

test("returns the checksummed address", async () => {
  const r = await scanAddress("0x52908400098527886e0f7030069857d2e4169ee7", { chain: nullChain, explorer: fakeExplorer([]) });
  assert.equal(r.address, "0x52908400098527886E0F7030069857D2E4169EE7");
});

test("maxBurst counts distinct recipients inside a 10-minute window", () => {
  const spread = Array.from({ length: 12 }, (_, i) => tx(ME, addr(i), i * 120)); // 2 min apart → 6 per window
  assert.equal(maxBurst(spread), 6);
  assert.equal(maxBurst([tx(ME, addr(1), 0), tx(ME, addr(1), 10)]), 1);
});

test("verdict thresholds", () => {
  assert.deepEqual([0, 34, 35, 69, 70, 100].map(verdictFor), ["SAFE", "SAFE", "SUSPICIOUS", "SUSPICIOUS", "HIGH_RISK", "HIGH_RISK"]);
});
