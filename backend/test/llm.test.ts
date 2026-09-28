import assert from "node:assert/strict";
import { test } from "node:test";
import { anthropicProvider, createLlm, openaiProvider, type LlmProvider } from "../src/lib/llm.js";
import { explain, explainScan } from "../src/services/explain.js";
import type { ExplainRequest } from "../src/types.js";

const REQ: ExplainRequest = { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", verdict: "HIGH_RISK", score: 95, reasons: ["This address is flagged on the registry (Investment scam)."], language: "en" };
const fake = (impl: LlmProvider["explain"]): LlmProvider => ({ name: "fake", explain: impl });

test("AI explanation is used when valid, with the reporting steps kept", async () => {
  const out = await explainScan(REQ, fake(async () => ({ explanation: "This address is flagged as an investment scam. Do not send money.", nextSteps: ["Report at https://cybercrime.gov.in", "Call 1930"] })));
  assert.equal(out.explanation, "This address is flagged as an investment scam. Do not send money.");
  assert.deepEqual(out.nextSteps, ["Report at https://cybercrime.gov.in", "Call 1930"]);
  assert.equal(out.language, "en");
});

test("missing helpline / portal steps are added from the template", async () => {
  const out = await explainScan(REQ, fake(async () => ({ explanation: "Flagged address.", nextSteps: ["Stop contact with the sender"] })));
  assert.equal(out.nextSteps[0], "Stop contact with the sender");
  assert.ok(out.nextSteps.some((s) => s.includes("cybercrime.gov.in")));
  assert.ok(out.nextSteps.some((s) => s.includes("1930")));
});

test("falls back to the template on failure, wrong language, or no LLM", async () => {
  const template = explain(REQ);
  assert.deepEqual(await explainScan(REQ, fake(async () => { throw new Error("timeout"); })), template);
  assert.deepEqual(await explainScan(REQ, null), template);
  const hi = { ...REQ, language: "hi" as const };
  assert.deepEqual(await explainScan(hi, fake(async () => ({ explanation: "English text only", nextSteps: [] }))), explain(hi));
  assert.deepEqual(await explainScan(REQ, fake(async () => ({ explanation: "x".repeat(2000), nextSteps: [] }))), template);
});

test("Hindi AI output in Devanagari is accepted", async () => {
  const hi = { ...REQ, language: "hi" as const };
  const out = await explainScan(hi, fake(async () => ({ explanation: "यह पता धोखाधड़ी से जुड़ा है।", nextSteps: ["1930 पर कॉल करें", "https://cybercrime.gov.in पर शिकायत करें"] })));
  assert.equal(out.explanation, "यह पता धोखाधड़ी से जुड़ा है।");
  assert.equal(out.nextSteps.length, 2);
});

test("anthropic provider: sends only the scan facts, low effort, JSON schema, refusal fallback", async () => {
  let sent: any;
  const client = {
    beta: {
      messages: {
        create: async (params: unknown) => {
          sent = params;
          return { stop_reason: "end_turn", content: [{ type: "text", text: '{"explanation":"Flagged.","nextSteps":["Call 1930"]}' }] };
        },
      },
    },
  } as any;
  const p = anthropicProvider({ apiKey: "test", model: "claude-opus-5-5", timeoutMs: 1000 }, client);
  const out = await p.explain({ ...REQ, extra: "ignored" } as any, "en");
  assert.deepEqual(out, { explanation: "Flagged.", nextSteps: ["Call 1930"] });
  assert.equal(sent.model, "claude-opus-5-5");
  assert.deepEqual(JSON.parse(sent.messages[0].content), { address: REQ.address, verdict: "HIGH_RISK", score: 95, reasons: REQ.reasons });
  assert.match(sent.system, /Never invent/);
  assert.match(sent.system, /1930/);
  assert.equal(sent.output_config.effort, "low");
  assert.equal(sent.output_config.format.type, "json_schema");
  assert.equal(sent.fallbacks, "default");
  assert.deepEqual(sent.betas, ["server-side-fallback-2026-07-01"]);
});

test("anthropic provider: a refusal or truncated reply throws (→ template)", async () => {
  const client = { beta: { messages: { create: async () => ({ stop_reason: "refusal", content: [] }) } } } as any;
  await assert.rejects(anthropicProvider({ apiKey: "t", model: "claude-opus-5-5", timeoutMs: 1000 }, client).explain(REQ, "en"), /refusal/);
});

test("anthropic provider: no fallback params for models that don't take them", async () => {
  let sent: any;
  const client = { beta: { messages: { create: async (p: unknown) => ((sent = p), { stop_reason: "end_turn", content: [{ type: "text", text: '{"explanation":"x","nextSteps":[]}' }] }) } } } as any;
  await anthropicProvider({ apiKey: "t", model: "claude-haiku-4-5", timeoutMs: 1000 }, client).explain(REQ, "en");
  assert.equal(sent.fallbacks, undefined);
  assert.equal(sent.betas, undefined);
});

test("openai provider: JSON mode request, parses the reply", async () => {
  let url = "";
  let body: any;
  const fetchImpl = (async (u: string, init: RequestInit) => {
    url = u;
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: '{"explanation":"Flagged.","nextSteps":["Call 1930"]}' } }] }), { status: 200 });
  }) as typeof fetch;
  const out = await openaiProvider({ apiKey: "t", model: "some-model", timeoutMs: 1000 }, fetchImpl).explain(REQ, "hi");
  assert.equal(url, "https://api.openai.com/v1/chat/completions");
  assert.equal(body.model, "some-model");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.match(body.messages[0].content, /Hindi/);
  assert.equal(out.explanation, "Flagged.");
});

test("openai provider: HTTP errors throw", async () => {
  const fetchImpl = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(openaiProvider({ apiKey: "t", model: "m", timeoutMs: 1000 }, fetchImpl).explain(REQ, "en"), /HTTP 500/);
});

test("createLlm: templates unless provider and key are set; no invented defaults for openai", () => {
  assert.equal(createLlm({}), null);
  assert.equal(createLlm({ LLM_PROVIDER: "anthropic" }), null);
  assert.equal(createLlm({ LLM_PROVIDER: "openai", LLM_API_KEY: "k" }), null);
  assert.equal(createLlm({ LLM_PROVIDER: "other", LLM_API_KEY: "k" }), null);
  assert.equal(createLlm({ LLM_PROVIDER: "anthropic", LLM_API_KEY: "k" })?.name, "anthropic:claude-opus-5-5");
  assert.equal(createLlm({ LLM_PROVIDER: "openai", LLM_API_KEY: "k", LLM_MODEL: "m" })?.name, "openai:m");
});
