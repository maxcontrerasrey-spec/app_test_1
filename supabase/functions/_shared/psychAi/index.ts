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
    let result = await provider.interpret({
      payload: sanitizedPayload,
      systemPrompt: input.systemPrompt,
      responseSchema: input.responseSchema,
    });
    let guarded = validateAndGuardPsychAIOutput(result.output, sanitizedPayload);
    const semanticFailures = guarded.validationFlags.filter((flag) =>
      flag.includes("semantic") ||
      flag.includes("intensity") ||
      flag.includes("prp_") ||
      flag.includes("bis11_") ||
      flag.includes("risk_") ||
      flag.includes("evidence") ||
      flag.includes("interview") ||
      flag.includes("regression")
    );
    if (semanticFailures.length) {
      result = await provider.interpret({
        payload: {
          ...sanitizedPayload,
          previous_semantic_errors: semanticFailures,
          retry_instruction:
            "Corrige exclusivamente los errores semanticos listados. No cambies scores, niveles, clasificaciones ni evidence_ids.",
        },
        systemPrompt: `${input.systemPrompt}\n\nErrores semanticos a corregir antes de responder: ${semanticFailures.join(", ")}.`,
        responseSchema: input.responseSchema,
      });
      guarded = validateAndGuardPsychAIOutput(result.output, sanitizedPayload);
      const retryFailures = guarded.validationFlags.filter((flag) =>
        flag.includes("semantic") ||
        flag.includes("intensity") ||
        flag.includes("prp_") ||
        flag.includes("bis11_") ||
        flag.includes("risk_") ||
        flag.includes("evidence") ||
        flag.includes("interview") ||
        flag.includes("regression")
      );
      if (retryFailures.length) {
        guarded = {
          ...guarded,
          validationFlags: [
            ...guarded.validationFlags,
            `semantic_guardrail_normalized_after_retry:${retryFailures.join("|")}`,
          ],
          guardrailFlags: [
            ...guarded.guardrailFlags,
            "semantic_guardrail_normalized_after_retry",
          ],
        };
      }
    }
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
      sanitizedPayload,
    );
    return {
      success: !liveConfigured,
      provider: provider.name,
      model: provider.model,
      latency_ms: 0,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 },
      output: fallback.output,
      validation_flags: [...fallback.validationFlags, "provider_failed_fallback_used"],
      guardrail_flags: fallback.guardrailFlags,
      live_configured: liveConfigured,
      fallback_reason: reason,
      error_code: liveConfigured ? "provider_failed" : null,
      error_message: liveConfigured ? reason : null,
    };
  }
}
