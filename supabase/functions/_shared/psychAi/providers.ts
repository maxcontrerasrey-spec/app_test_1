import { buildDeterministicPsychOutput } from "./guardrails.ts";
import type {
  JsonRecord,
  PsychAIPromptInput,
  PsychAIResult,
  PsychInterpretationProvider,
} from "./types.ts";

function now() {
  return performance.now();
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function resolveProviderFailureReason(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return "timeout";
  return error instanceof Error ? error.message.slice(0, 120) : "provider_error";
}

function readNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function estimateGpt5MiniCostUsd(inputTokens: number, cachedInputTokens: number, outputTokens: number) {
  const billableInput = Math.max(0, inputTokens - cachedInputTokens);
  // Official OpenAI docs list GPT-5 mini text pricing at $0.25/M input,
  // $0.025/M cached input, and $2.00/M output at implementation time.
  return ((billableInput * 0.25) + (cachedInputTokens * 0.025) + (outputTokens * 2.0)) / 1_000_000;
}

export class MockPsychInterpretationProvider implements PsychInterpretationProvider {
  name = "mock";
  model = "mock-psych-ai-v1";
  private reason: string;

  constructor(reason = "mock_provider") {
    this.reason = reason;
  }

  async interpret(input: PsychAIPromptInput): Promise<PsychAIResult> {
    const started = now();
    return {
      output: buildDeterministicPsychOutput(input.payload, this.reason),
      provider: this.name,
      model: this.model,
      latency_ms: Math.round(now() - started),
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 },
      raw_finish_reason: "mock",
    };
  }
}

export class OpenAIPsychInterpretationProvider implements PsychInterpretationProvider {
  name = "openai";
  model: string;
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(params: { apiKey: string; model: string; baseUrl?: string; timeoutMs?: number }) {
    this.apiKey = params.apiKey;
    this.model = params.model;
    this.baseUrl = (params.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.timeoutMs = params.timeoutMs ?? 90000;
  }

  async interpret(input: PsychAIPromptInput): Promise<PsychAIResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = now();
    try {
      const result = await fetch(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-Client-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            { role: "system", content: input.systemPrompt },
            {
              role: "user",
              content:
                "Interpreta el siguiente payload psicolaboral saneado. Devuelve solo JSON que cumpla el schema.\n\n" +
                JSON.stringify(input.payload),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: input.responseSchemaName ?? "psych_ai_interpretation",
              schema: input.responseSchema,
              strict: true,
            },
          },
          reasoning: {
            effort: Deno.env.get("PSYCH_AI_REASONING_EFFORT")?.trim() || "low",
          },
          max_output_tokens: Number(Deno.env.get("PSYCH_AI_MAX_OUTPUT_TOKENS")?.trim()) || 8000,
          store: false,
        }),
        signal: controller.signal,
      });
      const raw = await result.json().catch(() => ({})) as JsonRecord;
      if (!result.ok) {
        throw new Error(`openai_${result.status}_${readText((raw.error as JsonRecord | undefined)?.message, "request_failed")}`);
      }
      const incomplete = raw.incomplete_details as JsonRecord | undefined;
      if (raw.status === "incomplete") {
        throw new Error(`openai_incomplete_${readText(incomplete?.reason, "unknown")}`);
      }
      if (raw.error) {
        throw new Error(`openai_response_error_${readText((raw.error as JsonRecord).message, "unknown")}`);
      }
      const message = (raw.output as Array<JsonRecord> | undefined)?.find((item) => item.type === "message");
      const messageContent = (message?.content as Array<JsonRecord> | undefined)?.[0];
      if (messageContent?.type === "refusal") {
        throw new Error(`openai_refusal_${readText(messageContent.refusal, "refused").slice(0, 80)}`);
      }
      const content = readText(raw.output_text) ||
        (messageContent?.type === "output_text" ? readText(messageContent.text) : "");
      if (!content) {
        throw new Error(`openai_empty_content_${readText(raw.status, "unknown_status")}`);
      }
      const parsed = JSON.parse(content);
      const usage = (raw.usage ?? {}) as JsonRecord;
      const inputDetails = (usage.input_tokens_details ?? usage.prompt_tokens_details ?? {}) as JsonRecord;
      const outputDetails = (usage.output_tokens_details ?? usage.completion_tokens_details ?? {}) as JsonRecord;
      const promptTokens = readNumber(usage.input_tokens ?? usage.prompt_tokens);
      const completionTokens = readNumber(usage.output_tokens ?? usage.completion_tokens);
      const cachedPromptTokens = readNumber(inputDetails.cached_tokens ?? inputDetails.cached_input_tokens);
      const reasoningTokens = readNumber(outputDetails.reasoning_tokens);
      return {
        output: parsed,
        provider: this.name,
        model: this.model,
        latency_ms: Math.round(now() - started),
        usage: {
          prompt_tokens: promptTokens,
          cached_prompt_tokens: cachedPromptTokens,
          completion_tokens: completionTokens,
          reasoning_tokens: reasoningTokens,
          total_tokens: readNumber(usage.total_tokens),
          estimated_cost_usd: estimateGpt5MiniCostUsd(promptTokens, cachedPromptTokens, completionTokens),
        },
        raw_finish_reason: readText(raw.status),
      };
    } catch (error) {
      throw new Error(resolveProviderFailureReason(error));
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createPsychInterpretationProvider() {
  const enabled = Deno.env.get("PSYCH_AI_ENABLED")?.trim().toLowerCase() === "true";
  const provider = Deno.env.get("PSYCH_AI_PROVIDER")?.trim().toLowerCase() || "mock";
  const model = Deno.env.get("PSYCH_AI_MODEL")?.trim() || "gpt-5-mini";
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const fallbackReason = enabled && provider === "openai" && !apiKey ? "missing_openai_api_key" : "feature_flag_disabled";

  if (enabled && provider === "openai" && apiKey) {
    return {
      provider: new OpenAIPsychInterpretationProvider({
        apiKey,
        model,
        baseUrl: Deno.env.get("OPENAI_BASE_URL")?.trim() || undefined,
        timeoutMs: Number(Deno.env.get("PSYCH_AI_TIMEOUT_MS")?.trim()) || undefined,
      }),
      fallbackReason: "",
      liveConfigured: true,
    };
  }

  return {
    provider: new MockPsychInterpretationProvider(fallbackReason),
    fallbackReason,
    liveConfigured: false,
  };
}
