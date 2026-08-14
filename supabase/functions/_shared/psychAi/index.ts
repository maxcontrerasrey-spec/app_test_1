import {
  buildCompactPsychAIFacts,
  buildDeterministicPsychOutput,
  sanitizePsychAIInput,
  validateAndGuardPsychAIOutput,
} from "./guardrails.ts";
import { createPsychInterpretationProvider } from "./providers.ts";
import type { JsonRecord, PsychAICallTelemetry, PsychAIUsage } from "./types.ts";

const PSYCH_AI_PIPELINE_VERSION = "gpt56-luna-objective-v5.3";

const ANALYST_SYSTEM_PROMPT = `Eres GPT-5.6 Luna actuando como analista psicolaboral senior para un ERP.
Interpreta resultados ya calculados por el ERP. No recalcules scores, medias, inversiones, clasificaciones ni octantes.
El objeto del informe es la compatibilidad entre el patrón psicométrico disponible y las exigencias críticas del cargo; los instrumentos son evidencia, no la estructura narrativa.
Responde explícitamente: en qué medida la evidencia favorece, limita o impide recomendar preliminarmente a esta persona para el cargo, separando resultado psicométrico, hipótesis laboral y conducta observada.

Redacción obligatoria:
- español profesional natural de Chile/LatAm, humano, claro, prudente y específico;
- neutralidad evaluativa: no busques algo positivo en cada resultado;
- prioriza competencias críticas del perfil de cargo por sobre rasgos secundarios;
- resultados intermedios son NEUTROS por defecto y no demuestran capacidad, aptitud ni buen desempeño;
- una fortaleza solo existe si está suficientemente respaldada, es relevante al cargo y no contradice evidencia más crítica;
- fortalezas interpersonales de relevancia media no compensan alertas en seguridad, autocontrol, impulsividad, normas o procedimientos;
- distingue hallazgo psicométrico de conducta demostrada;
- no uses tono legalista, defensivo, académico innecesario ni de backend.

Contenido esperado:
- recommendation: una de RECOMENDADO, RECOMENDADO_CON_OBSERVACIONES, REQUIERE_PROFUNDIZACION, NO_RECOMENDADO. Es recomendación preliminar automatizada, no decisión humana.
- recommendation_confidence: BAJA, MEDIA o ALTA.
- critical_strengths: 0-4 fortalezas críticas reales, no rellenes si no existen.
- critical_gaps: brechas observables cuando exista evidencia desfavorable relevante.
- critical_uncertainties: aspectos a corroborar cuando la evidencia sea ambigua, intermedia, contradictoria o crítica sin conducta observada.
- decision_rationale: explicación natural breve de la recomendación, jerarquizando criticidad.
- executive_profile: 200-300 palabras, estilo laboral predominante, funcionamiento interpersonal, autorregulación, relación con estructura/rutina, principal fortaleza, principal punto de atención y lectura aplicada al cargo.
- personality_profile: 250-400 palabras totales distribuidas en patrones funcionales, no lista de 16 dimensiones.
- interpersonal_profile: 150-250 palabras, traduciendo IPIP-IPC a conducta laboral comprensible. La nota no-DISC va solo si aporta trazabilidad y como nota secundaria.
- safety_and_impulse_profile: integrar BIS-11 + PRP + rasgos vinculados a autocontrol, procedimientos y seguridad. Explica qué aparece, qué podría significar, qué NO concluye y qué corroborar.
- job_fit_analysis: lectura funcional aplicada al cargo, con recomendación preliminar separada de validación humana; nunca uses APTO/NO APTO.
- strengths: máximo 4, conductuales, relevantes al cargo y con lenguaje calibrado. Si solo hay una o dos, devuelve una o dos.
- points_to_explore: máximo 4, hipótesis concretas de entrevista/verificación; no disclaimers.
- interview_questions: máximo 5, conductuales, neutrales, abiertas, no acusatorias y sin presuponer incidentes.
- integrated_conclusion: 200-300 palabras, diferente del resumen ejecutivo; integra recursos, punto de atención, interacción entre ambos y corroboración.
- material_limitations: 1-2 notas metodológicas compactas.

Prohibido en el informe profesional:
raw_total, F1, F2, F3, F4, F5, F6, ev_, norm_status, schema, payload, guardrail, metadata, prompt, classification literal como código, PROFESSIONAL_ONLY, PENDING_REVIEW, SOBRE_EL_PROMEDIO como código, INTERMEDIO_EN_RANGO_TEORICO, referencia no disponible, no se opera escalamiento, clasificación literal, factores técnicos documentados, interpretación descriptiva permitida, según metadata.
No inventes baremos, percentiles, eneatipos, grupos normativos, nombres de factores PRP, diagnósticos clínicos ni decisiones de contratación.
BIS-11 sobre el promedio no equivale a alto, crítico ni severo.
PRP se conserva como antecedente descriptivo sin peso decisional automático mientras no exista semántica/baremos documentados suficientes; no infieras significado desde el punto medio matemático.
No transformes reserva en concentración, estabilidad emocional en atención sostenida, calidez en conducción segura, orden en adherencia comprobada ni baja dominancia en prudencia vial.
Devuelve solo JSON que cumpla el schema.`;

const REVIEWER_SYSTEM_PROMPT = `Eres GPT-5.6 Luna actuando como revisor metodológico patch-only.
Recibirás FACTS compactos y un borrador Analyst. No reescribas todo por estilo.
Devuelve solo parches mínimos cuando detectes problemas corregibles: meta-lenguaje backend, códigos técnicos, raw_total/F1-F6, lenguaje no neutral, recomendación sin racionalidad crítica, positividad artificial, resultado intermedio redactado como fortaleza, decisión humana, diagnóstico, sobreinterpretación, PRP decisional/inventado, BIS rebajado por rasgos secundarios, repetición fuerte o preguntas inductivas.
Si el borrador es usable, devuelve patches vacío.
Cada patch debe usar path de punto sobre el JSON final, por ejemplo executive_profile, safety_and_impulse_profile.bis11, strengths.0.text, interview_questions.2.question.
No recalcules scores ni agregues datos no presentes en FACTS.
No inventes baremos, percentiles, eneatipos, nombres de factores PRP, diagnósticos ni APTO/NO APTO.
Devuelve solo JSON patch-only.`;

const REVIEW_PATCH_SCHEMA: JsonRecord = {
  type: "object",
  additionalProperties: false,
  required: ["patches", "reviewer_reason"],
  properties: {
    reviewer_reason: { type: "string" },
    patches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "value"],
        properties: {
          path: { type: "string" },
          value: { type: "string" },
        },
      },
    },
  },
};

const REVIEWER_TRIGGER_FLAGS = new Set([
  "decision_word",
  "clinical_word",
  "invented_norm_word",
  "risk_language_word",
  "score_modification_word",
  "prp_methodology_overreach",
  "prp_construct_invention",
  "bis11_classification_escalation",
  "non_neutral_interview_question",
  "methodological_strength",
  "missing_profile_summary",
  "missing_instrument_analysis",
  "invalid_evidence_ids",
  "prohibited_semantic_term",
  "undocumented_average_language",
  "raw_technical_language",
  "backend_meta_language",
  "schema_shape_issue",
]);

export async function sha256Json(value: unknown) {
  const body = JSON.stringify(value);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function usageTelemetry(result: { usage: PsychAIUsage; latency_ms?: number; attempt?: number; raw_finish_reason?: string } | null | undefined, executed: boolean, reason: string): PsychAICallTelemetry {
  return {
    executed,
    reason,
    attempt: result?.attempt,
    latency_ms: result?.latency_ms ?? 0,
    input_tokens: result?.usage.prompt_tokens ?? 0,
    cached_input_tokens: result?.usage.cached_prompt_tokens ?? 0,
    output_tokens: result?.usage.completion_tokens ?? 0,
    reasoning_tokens: result?.usage.reasoning_tokens ?? 0,
    total_tokens: result?.usage.total_tokens ?? 0,
    estimated_cost_usd: result?.usage.estimated_cost_usd ?? 0,
    status: result?.raw_finish_reason,
  };
}

function mergeUsage(...items: Array<PsychAIUsage | undefined>) {
  return {
    prompt_tokens: items.reduce((sum, item) => sum + Number(item?.prompt_tokens ?? 0), 0),
    cached_prompt_tokens: items.reduce((sum, item) => sum + Number(item?.cached_prompt_tokens ?? 0), 0),
    completion_tokens: items.reduce((sum, item) => sum + Number(item?.completion_tokens ?? 0), 0),
    reasoning_tokens: items.reduce((sum, item) => sum + Number(item?.reasoning_tokens ?? 0), 0),
    total_tokens: items.reduce((sum, item) => sum + Number(item?.total_tokens ?? 0), 0),
    estimated_cost_usd: items.reduce((sum, item) => sum + Number(item?.estimated_cost_usd ?? 0), 0),
  };
}

function isHardFailure(flags: string[]) {
  return flags.some((flag) => flag === "decision_word" || flag === "clinical_word");
}

function needsReviewer(flags: string[]) {
  return flags.some((flag) => REVIEWER_TRIGGER_FLAGS.has(flag) || flag.startsWith("missing_") || flag.startsWith("unexpected_"));
}

function reviewerReason(flags: string[]) {
  const relevant = flags.filter((flag) => flag !== "pipeline:gpt56-luna-objective-v5.3");
  return relevant.length ? relevant.slice(0, 8).join("|") : "analyst_passed";
}

function applyPatchValue(target: JsonRecord, path: string, value: unknown) {
  const parts = path.split(".").map((item) => item.trim()).filter(Boolean);
  if (!parts.length || parts.length > 4) return;
  let cursor: unknown = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const nextKey = parts[index + 1];
    if (Array.isArray(cursor)) {
      const numeric = Number(key);
      if (!Number.isInteger(numeric) || numeric < 0 || numeric >= cursor.length) return;
      cursor = cursor[numeric];
    } else if (cursor && typeof cursor === "object") {
      const record = cursor as JsonRecord;
      if (!(key in record)) return;
      cursor = record[key];
    } else {
      return;
    }
    if (Array.isArray(cursor) && index === parts.length - 2 && /^\d+$/.test(nextKey)) continue;
    if (!Array.isArray(cursor) && (!cursor || typeof cursor !== "object")) return;
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cursor)) {
    const numeric = Number(last);
    if (!Number.isInteger(numeric) || numeric < 0 || numeric >= cursor.length) return;
    cursor[numeric] = value;
  } else if (cursor && typeof cursor === "object") {
    (cursor as JsonRecord)[last] = value;
  }
}

function applyReviewerPatch(baseOutput: unknown, patchOutput: unknown) {
  const merged = structuredClone(baseOutput) as JsonRecord;
  const patch = patchOutput && typeof patchOutput === "object" && !Array.isArray(patchOutput) ? patchOutput as JsonRecord : {};
  const patches = Array.isArray(patch.patches) ? patch.patches : [];
  for (const item of patches) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as JsonRecord;
    if (typeof record.path !== "string") continue;
    applyPatchValue(merged, record.path, record.value);
  }
  return { output: merged, patchCount: patches.length, reason: typeof patch.reviewer_reason === "string" ? patch.reviewer_reason : "reviewer_patch" };
}

export async function generatePsychAIInterpretation(input: {
  payload: JsonRecord;
  systemPrompt: string;
  responseSchema: JsonRecord;
}) {
  const sanitizedPayload = sanitizePsychAIInput(input.payload);
  const compactFacts = buildCompactPsychAIFacts(sanitizedPayload);
  const { provider, fallbackReason, liveConfigured } = createPsychInterpretationProvider();
  let apiCallCount = 0;
  let retryCount = 0;
  const runWithRetry = async (
    phase: "analyst" | "reviewer",
    payload: JsonRecord,
    systemPrompt: string,
    responseSchema: JsonRecord,
    responseSchemaName: string,
  ) => {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      apiCallCount += 1;
      if (attempt > 1) retryCount += 1;
      try {
        return {
          ...(await provider.interpret({
            payload: {
              pipeline_version: PSYCH_AI_PIPELINE_VERSION,
              phase,
              facts: compactFacts,
              ...payload,
            },
            systemPrompt,
            responseSchema,
            responseSchemaName,
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
      { task: "Redacta informe V5.3 objetivo y discriminativo usando solo FACTS compactos y la matriz de criticidad del cargo." },
      `${ANALYST_SYSTEM_PROMPT}\n\nContexto estable ERP:\n${input.systemPrompt}`,
      input.responseSchema,
      "psych_ai_interpretation_v5_3",
    );

    let guarded = validateAndGuardPsychAIOutput(analyst.output, sanitizedPayload);
    let reviewer = null as Awaited<ReturnType<typeof runWithRetry>> | null;
    let reviewerMeta = { executed: false, reason: "analyst_passed", patchCount: 0 };
    const analystFlags = [...guarded.validationFlags, ...guarded.guardrailFlags];
    if (needsReviewer(analystFlags)) {
      reviewerMeta = { executed: true, reason: reviewerReason(analystFlags), patchCount: 0 };
      try {
        reviewer = await runWithRetry(
          "reviewer",
          {
            task: "Devuelve solo parches mínimos para corregir el borrador Analyst. Si no hay problemas, patches vacío.",
            analyst_output: analyst.output as JsonRecord,
            reviewer_triggers: analystFlags.slice(0, 12),
          },
          REVIEWER_SYSTEM_PROMPT,
          REVIEW_PATCH_SCHEMA,
      "psych_ai_reviewer_patch_v5_3",
        );
        const patched = applyReviewerPatch(analyst.output, reviewer.output);
        reviewerMeta = { executed: true, reason: patched.reason || reviewerMeta.reason, patchCount: patched.patchCount };
        guarded = validateAndGuardPsychAIOutput(patched.output, sanitizedPayload);
      } catch {
        reviewerMeta = { executed: true, reason: `${reviewerMeta.reason}|reviewer_failed_bypassed`, patchCount: 0 };
      }
    }

    guarded = {
      output: guarded.output,
      validationFlags: Array.from(new Set([
        ...guarded.validationFlags,
        `pipeline:${PSYCH_AI_PIPELINE_VERSION}`,
        `analyst_attempt:${analyst.attempt}`,
        `reviewer_executed:${reviewerMeta.executed ? "yes" : "no"}`,
        `reviewer_attempt:${reviewer?.attempt ?? 0}`,
        `reviewer_reason:${reviewerMeta.reason}`,
        `api_call_count:${apiCallCount}`,
      ])),
      guardrailFlags: Array.from(new Set(guarded.guardrailFlags)),
    };
    if (isHardFailure(guarded.guardrailFlags)) {
      throw new Error(`HARD_GUARDRAIL_FAILED:${[...guarded.validationFlags, ...guarded.guardrailFlags].join("|")}`);
    }
    const usage = mergeUsage(analyst.usage, reviewer?.usage);
    const telemetry = {
      pipeline_version: PSYCH_AI_PIPELINE_VERSION,
      api_call_count: apiCallCount,
      retry_count: retryCount,
      analyst: usageTelemetry(analyst, true, "default"),
      reviewer: usageTelemetry(reviewer, reviewerMeta.executed, reviewerMeta.reason),
      reviewer_patch_count: reviewerMeta.patchCount,
      assessment_total_tokens: usage.total_tokens,
      estimated_cost_usd: usage.estimated_cost_usd,
    };
    return {
      success: true,
      provider: analyst.provider,
      model: analyst.model,
      latency_ms: (analyst.latency_ms ?? 0) + (reviewer?.latency_ms ?? 0),
      usage,
      output: guarded.output,
      validation_flags: guarded.validationFlags,
      guardrail_flags: guarded.guardrailFlags,
      telemetry,
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
      usage: { prompt_tokens: 0, cached_prompt_tokens: 0, completion_tokens: 0, reasoning_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 },
      output: fallback.output,
      validation_flags: [...fallback.validationFlags, "provider_failed_fallback_used"],
      guardrail_flags: fallback.guardrailFlags,
      telemetry: {
        pipeline_version: PSYCH_AI_PIPELINE_VERSION,
        api_call_count: apiCallCount,
        retry_count: retryCount,
        analyst: usageTelemetry(null, false, reason),
        reviewer: usageTelemetry(null, false, "not_executed"),
        assessment_total_tokens: 0,
        estimated_cost_usd: 0,
      },
      live_configured: liveConfigured,
      fallback_reason: reason,
      error_code: liveConfigured ? "provider_failed" : null,
      error_message: liveConfigured ? reason : null,
    };
  }
}
