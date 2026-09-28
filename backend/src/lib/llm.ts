import Anthropic from "@anthropic-ai/sdk";
import type { Language, Verdict } from "../types.js";

/** Only what the scan produced — the model sees nothing else. */
export interface ScanFacts {
  address: string;
  verdict: Verdict;
  score: number;
  reasons: string[];
}

export interface LlmOutput {
  explanation: string;
  nextSteps: string[];
}

export interface LlmProvider {
  readonly name: string;
  explain(scan: ScanFacts, language: Language): Promise<LlmOutput>;
}

const LANGUAGE_NAME: Record<Language, string> = { en: "English", hi: "Hindi (Devanagari script)" };

export function systemPrompt(language: Language): string {
  return [
    "You explain the result of a crypto address risk scan to a non-technical person in India who may be a scam victim.",
    "The user message is the scan result as JSON: address, verdict (SAFE | SUSPICIOUS | HIGH_RISK), score (0-100) and reasons.",
    "Use only facts in that JSON. Never invent transactions, amounts, dates, names, owners or reasons that are not in it.",
    "If a reason says some data was unavailable or not checked, say so plainly instead of guessing.",
    "SAFE is not a guarantee; say so. Do not give financial or legal advice beyond the reporting steps.",
    `Write in ${LANGUAGE_NAME[language]}, in 2-4 short, calm sentences.`,
    "nextSteps: 2-4 short, practical steps. Always include reporting at https://cybercrime.gov.in and calling the national cybercrime helpline 1930.",
    'Reply with JSON only: {"explanation": string, "nextSteps": string[]}.',
  ].join("\n");
}

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    explanation: { type: "string" },
    nextSteps: { type: "array", items: { type: "string" } },
  },
  required: ["explanation", "nextSteps"],
  additionalProperties: false,
} as const;

/** Parses and sanity-checks model output; throws if it isn't usable. */
export function parseOutput(text: string): LlmOutput {
  const data = JSON.parse(text) as Partial<LlmOutput>;
  if (typeof data.explanation !== "string" || !data.explanation.trim()) throw new Error("no explanation");
  if (!Array.isArray(data.nextSteps) || !data.nextSteps.every((s) => typeof s === "string")) throw new Error("bad nextSteps");
  return { explanation: data.explanation.trim(), nextSteps: data.nextSteps.map((s) => s.trim()).filter(Boolean) };
}

const facts = (scan: ScanFacts): ScanFacts => ({ address: scan.address, verdict: scan.verdict, score: scan.score, reasons: scan.reasons });

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

type MessagesClient = Pick<Anthropic, "beta">;

/** Claude via the official SDK: structured JSON output, low effort (short answer), refusal fallback. */
export function anthropicProvider(opts: { apiKey: string; model: string; timeoutMs: number }, client?: MessagesClient): LlmProvider {
  const c = client ?? new Anthropic({ apiKey: opts.apiKey, timeout: opts.timeoutMs, maxRetries: 0 });
  const withFallback = FALLBACK_MODELS.has(opts.model);
  return {
    name: `anthropic:${opts.model}`,
    async explain(scan, language) {
      const response = await c.beta.messages.create(
        {
          model: opts.model,
          max_tokens: 4000,
          system: systemPrompt(language),
          messages: [{ role: "user", content: JSON.stringify(facts(scan)) }],
          output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
          ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        },
        { signal: AbortSignal.timeout(opts.timeoutMs) },
      );
      if (response.stop_reason !== "end_turn") throw new Error(`stop_reason ${response.stop_reason}`);
      const text = response.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") throw new Error("no text block");
      return parseOutput(text.text);
    },
  };
}

/** OpenAI-compatible chat completions over HTTP (JSON mode). */
export function openaiProvider(opts: { apiKey: string; model: string; timeoutMs: number; baseUrl?: string }, fetchImpl: typeof fetch = fetch): LlmProvider {
  const base = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return {
    name: `openai:${opts.model}`,
    async explain(scan, language) {
      const res = await fetchImpl(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({
          model: opts.model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt(language) },
            { role: "user", content: JSON.stringify(facts(scan)) },
          ],
        }),
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
      const choice = data.choices?.[0];
      if (!choice?.message?.content || choice.finish_reason !== "stop") throw new Error(`finish_reason ${choice?.finish_reason}`);
      return parseOutput(choice.message.content);
    },
  };
}

/**
 * From env: LLM_PROVIDER (anthropic | openai), LLM_API_KEY, LLM_MODEL, LLM_TIMEOUT_MS, LLM_BASE_URL (openai only).
 * Returns null — templates only — when the provider or key is missing.
 */
export function createLlm(env: NodeJS.ProcessEnv = process.env): LlmProvider | null {
  const provider = env.LLM_PROVIDER?.trim().toLowerCase();
  const apiKey = env.LLM_API_KEY?.trim();
  const timeoutMs = Number(env.LLM_TIMEOUT_MS ?? 10_000);
  if (!provider || provider === "none" || !apiKey) return null;
  if (provider === "anthropic") return anthropicProvider({ apiKey, model: env.LLM_MODEL?.trim() || "claude-opus-5-5", timeoutMs });
  if (provider === "openai") {
    const model = env.LLM_MODEL?.trim();
    if (!model) {
      console.warn("[llm] LLM_PROVIDER=openai needs LLM_MODEL — using templates");
      return null;
    }
    return openaiProvider({ apiKey, model, timeoutMs, baseUrl: env.LLM_BASE_URL?.trim() || undefined });
  }
  console.warn(`[llm] unknown LLM_PROVIDER "${provider}" — using templates`);
  return null;
}
