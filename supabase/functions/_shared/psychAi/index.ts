import {
  buildDeterministicPsychOutput,
  sanitizePsychAIInput,
  validateAndGuardPsychAIOutput,
} from "./guardrails.ts";
import { createPsychInterpretationProvider } from "./providers.ts";
import type { JsonRecord } from "./types.ts";

const PSYCH_AI_PIPELINE_VERSION = "gpt5-mini-methodological-v5";

const ANALYST_SYSTEM_PROMPT = `Eres GPT-5 mini actuando como ANALYST psicolaboral para un ERP.
Tu tarea es interpretar de forma integrada resultados psicolaborales ya calculados por el ERP.
Usa exclusivamente FACTS pseudonimizados, metodología versionada, perfil de cargo, calidad y contexto normativo entregados.
No recalcules scores, medias, inversiones, octantes ni clasificaciones.
No inventes baremos, percentiles, eneatipos, grupos normativos, factores PRP, diagnósticos clínicos, APTO/NO APTO, contratar, rechazar ni descartar.
No presentes IPIP-16 como 16PF propietario ni IPIP-IPC como DISC/Everything DiSC.
Interpreta activamente toda información metodológicamente disponible.
No respondas "requiere interpretación profesional" cuando el payload permite interpretación descriptiva.
Si un instrumento tiene automatic_interpretation_allowed=true, intégralo activamente.
Si una dimensión o factor carece de significado documentado, omite solo esa parte específica; no bloquees todo el instrumento.
La ausencia de baremo local no impide interpretación descriptiva.
Distingue medición directa, inferencia laboral y relevancia para el cargo.
No conviertas criticidad del cargo en severidad del resultado del candidato.
Conserva clasificaciones documentadas: BIS-11 SOBRE_EL_PROMEDIO no es alto, crítico ni severo.
PRP puede interpretarse como patrón preventivo descriptivo solo desde score total, dirección de ítems y factores técnicos F1-F6, sin nombrar constructos no documentados.
Redacta para RR.HH. o profesional laboral, en español de Chile, tono claro, ejecutivo, útil y no clínico.
Prioriza síntesis integrada sobre enumeración de scores.
Las preguntas de entrevista deben ser neutrales, conductuales y no inductivas.
Devuelve solo JSON que cumpla el schema.`;

const REVIEWER_SYSTEM_PROMPT = `Eres GPT-5 mini actuando como REVIEWER metodológico de un análisis psicolaboral.
Tu función es mejorar y corregir el análisis, no volverlo conservador por defecto.
FACTS tienen prioridad absoluta sobre el borrador Analyst.
Corrige o elimina afirmaciones no respaldadas: intensidad, alucinaciones, PRP, BIS-11, riesgo, contradicciones, preguntas inductivas, duplicados, códigos internos o lenguaje propietario.
No recalcules scores ni inventes baremos, percentiles, eneatipos, factores PRP, diagnósticos o decisiones.
No uses comparación poblacional sin benchmark documentado.
Si BIS-11 es SOBRE_EL_PROMEDIO, elimina ALTO, MUY ALTO, CRÍTICO, SEVERO o intervención referidos a BIS.
PRP debe interpretarse si automatic_interpretation_allowed=true; si un factor PRP carece de nombre documentado, omite solo ese factor.
No sustituyas análisis válido por disclaimers ni por "requiere revisión profesional".
El resultado final debe ser más claro, coherente, integrado y útil que el borrador.
No APTO/NO APTO, no diagnóstico clínico, no decisión automática.
Devuelve el JSON final corregido, listo para revisión profesional humana, sin review_meta.`;

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
  const isHardFailure = (flags: string[]) =>
    flags.some((flag) =>
      flag === "decision_word" ||
      flag === "clinical_word"
    );
  const mergeUsage = (...items: Array<{ prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; estimated_cost_usd?: number }>) => ({
    prompt_tokens: items.reduce((sum, item) => sum + Number(item.prompt_tokens ?? 0), 0),
    completion_tokens: items.reduce((sum, item) => sum + Number(item.completion_tokens ?? 0), 0),
    total_tokens: items.reduce((sum, item) => sum + Number(item.total_tokens ?? 0), 0),
    estimated_cost_usd: items.reduce((sum, item) => sum + Number(item.estimated_cost_usd ?? 0), 0),
  });
  const runWithRetry = async (phase: "analyst" | "reviewer", payload: JsonRecord, systemPrompt: string) => {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return {
          ...(await provider.interpret({
            payload: {
              pipeline_version: PSYCH_AI_PIPELINE_VERSION,
              phase,
              facts: sanitizedPayload,
              ...payload,
            },
            systemPrompt,
            responseSchema: input.responseSchema,
          })),
          attempt,
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`${phase}_failed`);
  };
  try {
    const analyst = await runWithRetry(
      "analyst",
      { task: "Genera el borrador Analyst usando solo facts." },
      `${ANALYST_SYSTEM_PROMPT}\n\nContexto de versionado ERP:\n${input.systemPrompt}`,
    );
    let reviewer = null as Awaited<ReturnType<typeof runWithRetry>> | null;
    let reviewerBypassed = false;
    try {
      reviewer = await runWithRetry(
        "reviewer",
        {
          task: "Revisa y corrige el borrador Analyst contra facts. Devuelve solo la salida final corregida.",
          analyst_output: analyst.output as unknown as JsonRecord,
        },
        `${REVIEWER_SYSTEM_PROMPT}\n\nContexto de versionado ERP:\n${input.systemPrompt}`,
      );
    } catch {
      reviewerBypassed = true;
    }

    const selected = reviewer ?? analyst;
    let guarded = validateAndGuardPsychAIOutput(selected.output, sanitizedPayload);
    guarded = {
      output: guarded.output,
      validationFlags: Array.from(new Set([
        ...guarded.validationFlags,
        `pipeline:${PSYCH_AI_PIPELINE_VERSION}`,
        `analyst_attempt:${analyst.attempt}`,
        `reviewer_attempt:${reviewer?.attempt ?? 0}`,
        ...(reviewerBypassed ? ["REVIEWER_BYPASSED_DUE_TO_FAILURE"] : []),
      ])),
      guardrailFlags: Array.from(new Set([
        ...guarded.guardrailFlags,
        ...(reviewerBypassed ? ["REVIEWER_BYPASSED_DUE_TO_FAILURE"] : []),
      ])),
    };
    if (isHardFailure(guarded.guardrailFlags)) {
      if (!reviewer && !reviewerBypassed) {
        throw new Error("HARD_GUARDRAIL_FAILED");
      }
      throw new Error(`HARD_GUARDRAIL_FAILED:${[...guarded.validationFlags, ...guarded.guardrailFlags].join("|")}`);
    }
    const usage = mergeUsage(analyst.usage, reviewer?.usage ?? {});
    return {
      success: true,
      provider: selected.provider,
      model: selected.model,
      latency_ms: analyst.latency_ms + (reviewer?.latency_ms ?? 0),
      usage,
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
