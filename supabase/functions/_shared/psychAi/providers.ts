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

export class MockPsychInterpretationProvider implements PsychInterpretationProvider {
  name = "mock";
  model = "mock-psych-ai-v1";

  async interpret(input: PsychAIPromptInput): Promise<PsychAIResult> {
    const started = now();
    return {
      output: buildDeterministicPsychOutput(input.payload, "mock_provider"),
      provider: this.name,
      model: this.model,
      latency_ms: Math.round(now() - started),
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 },
      raw_finish_reason: "mock",
    };
  }
}

export class GroqPsychInterpretationProvider implements PsychInterpretationProvider {
  name = "groq";
  model: string;
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(params: { apiKey: string; model: string; baseUrl?: string; timeoutMs?: number }) {
    this.apiKey = params.apiKey;
    this.model = params.model;
    this.baseUrl = (params.baseUrl ?? "https://api.groq.com/openai/v1").replace(/\/$/, "");
    this.timeoutMs = params.timeoutMs ?? 24000;
  }

  async interpret(input: PsychAIPromptInput): Promise<PsychAIResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = now();
    try {
      const result = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: input.systemPrompt },
            {
              role: "user",
              content:
                "Interpreta el siguiente payload psicolaboral saneado. Devuelve solo JSON que cumpla el schema.\n\n" +
                JSON.stringify(input.payload),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "psych_ai_interpretation",
              schema: input.responseSchema,
              strict: true,
            },
          },
          reasoning_effort: "low",
          temperature: 0.2,
          max_completion_tokens: 1800,
          stream: false,
        }),
        signal: controller.signal,
      });
      const raw = await result.json().catch(() => ({})) as JsonRecord;
      if (!result.ok) {
        throw new Error(`groq_${result.status}_${readText((raw.error as JsonRecord | undefined)?.message, "request_failed")}`);
      }
      const content = readText(
        ((raw.choices as Array<JsonRecord> | undefined)?.[0]?.message as JsonRecord | undefined)?.content,
      );
      if (!content) throw new Error("groq_empty_content");
      const parsed = JSON.parse(content);
      const usage = (raw.usage ?? {}) as JsonRecord;
      return {
        output: parsed,
        provider: this.name,
        model: this.model,
        latency_ms: Math.round(now() - started),
        usage: {
          prompt_tokens: Number(usage.prompt_tokens ?? 0),
          completion_tokens: Number(usage.completion_tokens ?? 0),
          total_tokens: Number(usage.total_tokens ?? 0),
          estimated_cost_usd: 0,
        },
        raw_finish_reason: readText((raw.choices as Array<JsonRecord> | undefined)?.[0]?.finish_reason),
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
  const model = Deno.env.get("PSYCH_AI_MODEL")?.trim() || "openai/gpt-oss-120b";
  const apiKey = Deno.env.get("GROQ_API_KEY")?.trim();

  if (enabled && provider === "groq" && apiKey) {
    return {
      provider: new GroqPsychInterpretationProvider({
        apiKey,
        model,
        baseUrl: Deno.env.get("GROQ_BASE_URL")?.trim() || undefined,
      }),
      fallbackReason: "",
      liveConfigured: true,
    };
  }

  return {
    provider: new MockPsychInterpretationProvider(),
    fallbackReason: enabled && provider === "groq" && !apiKey ? "missing_groq_api_key" : "feature_flag_disabled",
    liveConfigured: false,
  };
}
