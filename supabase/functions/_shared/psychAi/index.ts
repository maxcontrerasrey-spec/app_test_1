import {
  buildDeterministicPsychOutput,
  sanitizePsychAIInput,
  validateAndGuardPsychAIOutput,
} from "./guardrails.ts";
import { createPsychInterpretationProvider } from "./providers.ts";
import type { JsonRecord } from "./types.ts";

export async function sha256Json(value: unknown) {
  const body = JSON.stringify(value);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function generatePsychAIInterpretation(input: {
  payload: JsonRecord;
  systemPrompt: string;
  responseSchema: JsonRecord;
}) {
  const sanitizedPayload = sanitizePsychAIInput(input.payload);
  const { provider, fallbackReason, liveConfigured } = createPsychInterpretationProvider();
  try {
    const result = await provider.interpret({
      payload: sanitizedPayload,
      systemPrompt: input.systemPrompt,
      responseSchema: input.responseSchema,
    });
    const guarded = validateAndGuardPsychAIOutput(result.output);
    return {
      success: true,
      provider: result.provider,
      model: result.model,
      latency_ms: result.latency_ms,
      usage: result.usage,
      output: guarded.output,
      validation_flags: guarded.validationFlags,
      guardrail_flags: guarded.guardrailFlags,
      live_configured: liveConfigured,
      fallback_reason: fallbackReason,
      error_code: null,
      error_message: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "provider_error";
    const fallback = validateAndGuardPsychAIOutput(
      buildDeterministicPsychOutput(sanitizedPayload, reason),
    );
    return {
      success: false,
      provider: provider.name,
      model: provider.model,
      latency_ms: 0,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 },
      output: fallback.output,
      validation_flags: [...fallback.validationFlags, "provider_failed_fallback_used"],
      guardrail_flags: fallback.guardrailFlags,
      live_configured: liveConfigured,
      fallback_reason: reason,
      error_code: "provider_failed",
      error_message: reason,
    };
  }
}
