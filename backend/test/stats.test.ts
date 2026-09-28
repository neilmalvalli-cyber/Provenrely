import assert from "node:assert/strict";
import { test } from "node:test";
import { id } from "ethers";
import type { Explorer } from "../src/lib/explorer.js";
import { createStats, SEND_SELECTOR } from "../src/services/stats.js";
import { addr, fakeChain, fakeExplorer } from "./helpers.js";

const SAFESEND = addr(0x5afe);
const opts = { startBlock: 0, chunkSize: 1000, maxChunksPerRefresh: 100, retries: 0, backoffMs: 1 };

test("SEND_SELECTOR is SafeSend.send(address)", () => {
  assert.equal(SEND_SELECTOR, id("send(address)").slice(0, 10));
});

test("no SafeSend address → transfersBlocked null, other counts real", async () => {
  const f = fakeChain({ [addr(1)]: 1, [addr(2)]: 2 });
  const s = await createStats(f.chain, fakeExplorer([]), opts)();
  assert.equal(s.flagsIssued, 2);
  assert.equal(s.certificatesAnchored, 0);
  assert.equal(s.transfersBlocked, null);
});

test("via the explorer: failed send() calls to SafeSend, by block range", async () => {
  const calls: unknown[][] = [];
  const explorer: Explorer = {
    recentTransactions: async () => [],
    countFailedCalls: async (...args) => (calls.push(args), 3),
  };
  const f = fakeChain();
  f.mine(9); // latest block 10
  const s = await createStats(f.chain, explorer, { ...opts, startBlock: 5, safeSendAddress: SAFESEND })();
  assert.equal(s.transfersBlocked, 3);
  assert.deepEqual(calls, [[SAFESEND, SEND_SELECTOR, 5, 10]]);
});

test("without an explorer: RPC block scan, incremental", async () => {
  const f = fakeChain();
  f.failedCalls.set(2, 1).set(3, 2);
  f.mine(4); // latest 5
  const stats = createStats(f.chain, fakeExplorer(null), { ...opts, safeSendAddress: SAFESEND, blockScan: { chunkSize: 2, maxChunksPerRefresh: 10 } });
  assert.equal((await stats()).transfersBlocked, 3);
});

test("explorer failures → transfersBlocked null (after retries), nothing cached", async () => {
  let fail = true;
  const explorer: Explorer = {
    recentTransactions: async () => [],
    countFailedCalls: async () => {
      if (fail) throw new Error("explorer HTTP 502");
      return 1;
    },
  };
  const stats = createStats(fakeChain().chain, explorer, { ...opts, retries: 1, safeSendAddress: SAFESEND });
  assert.equal((await stats()).transfersBlocked, null);
  fail = false;
  assert.equal((await stats()).transfersBlocked, 1); // not cached while incomplete, so it recovers
});
