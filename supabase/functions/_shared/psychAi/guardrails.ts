import { normalizePsychAIOutput, validateStrictShape } from "./schema.ts";
import {
  attachPsychSemanticContext,
  buildDeterministicPsychSemanticOutput,
  buildPsychSemanticContext,
  normalizeSemanticOutputForErp,
  PSYCH_SEMANTIC_VERSION,
  validatePsychSemanticOutput,
} from "./semantic.ts";
import type { GuardrailResult, JsonRecord, PsychAIOutput } from "./types.ts";

const PROHIBITED_PATTERNS: Array<[RegExp, string]> = [
  [/\b(no\s+apto|apto|contratar|no\s+contratar|rechazar|descartar)\b/i, "decision_word"],
  [/\bdiagn[oó]stic[oa]|trastorno|patolog[ií]a|enfermedad mental\b/i, "clinical_word"],
  [/\bpercentil|baremo chileno|eneatipo\s+[0-9]\b/i, "invented_norm_word"],
  [/\bcalcul[eé]|recalcul[eé]|modifiqu[eé]\s+score\b/i, "score_modification_word"],
  [/\b(riesgo cr[ií]tico|alto riesgo|riesgo severo|peligroso|inseguro|no recomendable|incompatible|requiere intervenci[oó]n)\b/i, "risk_language_word"],
  [/\b(raw_total|norm_status|schema|payload|metadata|guardrail|PROFESSIONAL_ONLY|PENDING_REVIEW|INTERMEDIO_EN_RANGO_TEORICO|SOBRE_EL_PROMEDIO|ev_[a-z0-9_]+)\b/i, "backend_meta_language"],
  [/\bF[1-6]\b|\bfactor(?:es)?\s+t[eé]cnic[oa]s?\b|\bclasificaci[oó]n literal\b|\bseg[uú]n metadata\b|\bno se opera escalamiento\b/i, "raw_technical_language"],
];

function collectStrings(value: unknown, out: string[] = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object") {
    Object.values(value as JsonRecord).forEach((item) => collectStrings(item, out));
  }
  return out;
}

function detectProhibitedFlags(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return PROHIBITED_PATTERNS
    .filter(([pattern, flag]) => {
      if (
        flag === "clinical_word" &&
        (
          /\bno\s+(?:constitu(?:ye|yen)|implica|representa|equivale\s+a)\s+(?:un\s+)?diagnostico\s+clinico\b/.test(normalized) ||
          /\bni\s+(?:un\s+)?diagnostico\s+clinico\b/.test(normalized)
        )
      ) {
        return false;
      }
      return pattern.test(text);
    })
    .map(([, flag]) => flag);
}

function replaceProhibited(text: string) {
  let cleaned = text;
  cleaned = cleaned.replace(/\braw_total\b/gi, "puntaje directo");
  cleaned = cleaned.replace(/\bnorm_status\b/gi, "estado metodológico");
  cleaned = cleaned.replace(/\bschema\b/gi, "estructura del informe");
  cleaned = cleaned.replace(/\bpayload\b/gi, "antecedentes disponibles");
  cleaned = cleaned.replace(/\bmetadata\b/gi, "antecedentes disponibles");
  cleaned = cleaned.replace(/\bguardrail(?:s)?\b/gi, "criterios metodológicos");
  cleaned = cleaned.replace(/\bev_[a-z0-9_]+\b/gi, "");
  cleaned = cleaned.replace(/\bF([1-6])\b/g, "factor $1");
  cleaned = cleaned.replace(/\bfactor(?:es)?\s+t[eé]cnic[oa]s?\b/gi, "aspectos preventivos medidos");
  cleaned = cleaned.replace(/\bclasificaci[oó]n literal\b/gi, "clasificación documentada");
  cleaned = cleaned.replace(/\bseg[uú]n metadata\b/gi, "según antecedentes disponibles");
  cleaned = cleaned.replace(/\bno se opera escalamiento\b/gi, "sin aumentar la intensidad del hallazgo");
  cleaned = cleaned.replace(/\breferencia no disponible\b/gi, "sin referencia poblacional documentada");
  cleaned = cleaned.replace(/\bSOBRE_EL_PROMEDIO\b/g, "sobre el promedio");
  cleaned = cleaned.replace(/\bINTERMEDIO_EN_RANGO_TEORICO\b/g, "intermedio dentro del rango teórico");
  cleaned = cleaned.replace(/\bALTO_EN_RANGO_TEORICO\b/g, "alto dentro del rango teórico");
  cleaned = cleaned.replace(/\bBAJO_EN_RANGO_TEORICO\b/g, "bajo dentro del rango teórico");
  cleaned = cleaned.replace(/\bMUY_ALTO_EN_RANGO_TEORICO\b/g, "muy alto dentro del rango teórico");
  cleaned = cleaned.replace(/\bMUY_BAJO_EN_RANGO_TEORICO\b/g, "muy bajo dentro del rango teórico");
  cleaned = cleaned.replace(/\bPROFESSIONAL_ONLY\b/g, "revisión profesional específica");
  cleaned = cleaned.replace(/\bPENDING_REVIEW\b/g, "pendiente de revisión");
  cleaned = cleaned.replace(/\bno\s+apto\b/gi, "requiere revisión profesional");
  cleaned = cleaned.replace(/\bapto\b/gi, "sin decisión automática");
  cleaned = cleaned.replace(/\bno\s+contratar\b/gi, "profundizar antes de decidir");
  cleaned = cleaned.replace(/\bcontratar\b/gi, "evaluar en comité");
  cleaned = cleaned.replace(/\brechazar\b/gi, "observar profesionalmente");
  cleaned = cleaned.replace(/\bdescartar\b/gi, "observar profesionalmente");
  cleaned = cleaned.replace(/\briesgo cr[ií]tico\b/gi, "punto de atención relevante");
  cleaned = cleaned.replace(/\balto riesgo\b/gi, "punto de atención relevante");
  cleaned = cleaned.replace(/\briesgo severo\b/gi, "punto de atención relevante");
  cleaned = cleaned.replace(/\bpeligros[oa]\b/gi, "desfavorable");
  cleaned = cleaned.replace(/\binsegur[oa]\b/gi, "desfavorable");
  cleaned = cleaned.replace(/\bno recomendable\b/gi, "requiere corroboración");
  cleaned = cleaned.replace(/\bincompatible\b/gi, "requiere corroboración");
  cleaned = cleaned.replace(/\brequiere intervenci[oó]n\b/gi, "requiere revisión profesional");
  cleaned = cleaned.replace(/\bdiagn[oó]stic[oa]\b/gi, "descripción");
  cleaned = cleaned.replace(/\btrastorno\b/gi, "patrón observado");
  cleaned = cleaned.replace(/\bpercentil(?:es)?\b/gi, "referencia no disponible");
  cleaned = cleaned.replace(/\bbaremo chileno\b/gi, "baremo no disponible");
  cleaned = cleaned.replace(/\beneatipo\s+[0-9]\b/gi, "eneatipo no informado");
  cleaned = cleaned.replace(/\bpor encima del promedio\b/gi, "sobre el promedio según la clasificación disponible");
  cleaned = cleaned.replace(/\bpor debajo del promedio\b/gi, "bajo el promedio según la clasificación disponible");
  cleaned = cleaned.replace(/\bjuicio cl[ií]nico o de riesgo\b/gi, "conclusión operacional desfavorable");
  return cleaned;
}

function sanitizeStrings(value: unknown): unknown {
  if (typeof value === "string") return replaceProhibited(value);
  if (Array.isArray(value)) return value.map(sanitizeStrings);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, item]) => [key, sanitizeStrings(item)]),
    );
  }
  return value;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundNumber(value: unknown, decimals = 2) {
  const numeric = readNumber(value);
  if (numeric === null) return null;
  return Number(numeric.toFixed(decimals));
}

export function sanitizePsychAIInput(input: JsonRecord) {
  const cloned = structuredClone(input) as JsonRecord;
  delete cloned.prompt;
  delete cloned.candidate;
  delete cloned.email;
  delete cloned.full_name;
  delete cloned.national_id;
  delete cloned.rut;
  delete cloned.responses;
  delete cloned.raw_answers;

  const scrub = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value
        .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[0-9kK]\b/g, "[RUT]")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
        .slice(0, 2000);
    }
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as JsonRecord).map(([key, item]) => [key, scrub(item)]),
      );
    }
    return value;
  };

  return attachPsychSemanticContext(scrub(cloned) as JsonRecord);
}

export function buildCompactPsychAIFacts(input: JsonRecord): JsonRecord {
  const semanticContext = buildPsychSemanticContext(input);
  const jobContext = asRecord(input.job_context);
  const profile = asRecord(jobContext.profile);
  const instruments = asArray(input.instruments).map(asRecord);
  const byCode = (code: string) => instruments.find((item) => item.code === code) ?? {};
  const compactQuality = (item: JsonRecord) => {
    const quality = asRecord(item.quality);
    return {
      status: readText(quality.status),
      completeness: roundNumber(quality.completitud, 1),
      distinct_values: readNumber(quality.valores_distintos),
      neutral_or_undecided: readNumber(quality.neutros_indecisos),
      straight_lining: Boolean(quality.straight_lining),
    };
  };
  const ipip = byCode("IPIP16_105");
  const ipipDimensions = Object.entries(asRecord(asRecord(ipip.result).dimensions)).map(([code, value]) => {
    const item = asRecord(value);
    const evidence = semanticContext.evidence_catalog.find((entry) => entry.instrument === "IPIP16_105" && entry.dimension === code);
    return {
      code,
      label: readText(item.name, code),
      score: roundNumber(item.mean),
      descriptive_level: evidence?.semanticLevel ?? null,
    };
  }).filter((item) => item.score !== null);
  const ipc = byCode("IPIP_IPC_32");
  const ipcResult = asRecord(ipc.result);
  const prp = byCode("PRP_EMAIL_FORM_A_30");
  const prpResult = asRecord(prp.result);
  const prpFactors = Object.entries(asRecord(prpResult.factors)).map(([code, value]) => ({
    code,
    score: roundNumber(value),
    documented_meaning: null,
  }));
  const barratt = byCode("BARRATT_BIS11_30");
  const barrattResult = asRecord(barratt.result);

  return {
    assessment: {
      public_ref: readText(input.assessment_public_ref),
      completed_at: input.completed_at ?? null,
    },
    job_context: {
      job_position_name: readText(jobContext.job_position_name),
      contract_name: readText(jobContext.contract_name),
      profile_label: readText(profile.label),
      critical_context: asArray(asRecord(profile.payload).critical_context).map((item) => readText(item)).filter(Boolean),
      interview_focus: asArray(asRecord(profile.payload).interview_focus).map((item) => readText(item)).filter(Boolean),
    },
    quality: Object.fromEntries(instruments.map((item) => [readText(item.code), compactQuality(item)])),
    instruments: {
      IPIP16_105: {
        interpretation_mode: "descriptiva por patrones laborales; no percentiles ni baremos 16PF",
        dimensions: ipipDimensions,
      },
      IPIP_IPC_32: {
        interpretation_mode: "modelo laboral interno IPIP-IPC; no DISC ni Everything DiSC",
        warmth: roundNumber(ipcResult.warmth),
        dominance: roundNumber(ipcResult.dominance),
        macrostyles: asRecord(asRecord(ipcResult.labor_profile).styles),
      },
      BARRATT_BIS11_30: {
        interpretation_mode: "clasificación documentada; no escalar a alto/crítico/severo",
        score: readNumber(barrattResult.total),
        classification: readText(barrattResult.classification),
      },
      PRP_EMAIL_FORM_A_30: {
        interpretation_mode: "lectura descriptiva preventiva; sin baremo poblacional activo",
        direct_score: readNumber(prpResult.raw_total),
        scale_min: 30,
        scale_midpoint: 90,
        scale_max: 150,
        documented_meaning: "El puntaje directo ubica el patrón general dentro de la escala matemática; no autoriza clasificación poblacional alto/medio/bajo.",
        factors: prpFactors,
      },
    },
    methodology: {
      version: "psych-methodology-v5.2-compact",
      professional_report_rules: {
        object_of_report: "persona y funcionamiento laboral aplicado al cargo",
        instruments_are_evidence: true,
        avoid_backend_language: true,
        avoid_raw_codes: true,
        max_strengths: 4,
        max_points_to_explore: 4,
        max_interview_questions: 5,
      },
      methodological_notes: [
        "Los resultados psicométricos son antecedentes complementarios y deben integrarse con entrevista y antecedentes laborales.",
        "Las interpretaciones sin baremos locales se expresan en términos descriptivos.",
      ],
    },
    constraints: {
      no_decision: true,
      no_diagnosis: true,
      no_score_changes: true,
      no_raw_answers: true,
      language: "es-CL",
      semantic_guardrails_version: PSYCH_SEMANTIC_VERSION,
    },
  };
}

export function validateAndGuardPsychAIOutput(value: unknown, input?: JsonRecord): GuardrailResult {
  const shape = validateStrictShape(value);
  const preSanitizeFlags = collectStrings(value).flatMap((text) =>
    detectProhibitedFlags(text)
  );
  const semanticContext = input ? buildPsychSemanticContext(input) : null;
  const rawSemanticValidation = semanticContext
    ? validatePsychSemanticOutput(value, semanticContext)
    : { ok: true, flags: [] };
  const normalized = semanticContext
    ? normalizeSemanticOutputForErp(sanitizeStrings(value), semanticContext)
    : normalizePsychAIOutput(sanitizeStrings(value));
  const finalSemanticValidation = semanticContext
    ? validatePsychSemanticOutput(normalized, semanticContext)
    : { ok: true, flags: [] };
  const guardrailFlags = collectStrings(normalized).flatMap((text) => detectProhibitedFlags(text));

  const methodologicalNotice =
    "Los resultados representan antecedentes complementarios de evaluación psicolaboral y deben ser considerados junto con entrevista, antecedentes laborales y demás información del proceso. No constituyen diagnóstico clínico ni una decisión automática de contratación.";
  normalized.limitations = Array.from(new Set([
    ...normalized.limitations.filter((item) =>
      !/diagn[oó]stic|descripci[oó]n cl[ií]nic|decisi[oó]n autom[aá]tica|revisi[oó]n profesional/i.test(item)
    ),
    methodologicalNotice,
  ])).slice(0, 4);
  normalized.material_limitations = normalized.limitations;
  normalized.version = "psych-ai-v5.2";

  normalized.ipc.disc_disclaimer =
    "Este modelo interno no corresponde a DISC ni a Everything DiSC; usa octantes IPIP-IPC y macroestilos laborales propios.";

  return {
    output: normalized,
    validationFlags: Array.from(new Set([...shape.flags, ...preSanitizeFlags, ...rawSemanticValidation.flags])),
    guardrailFlags: Array.from(new Set([...guardrailFlags, ...finalSemanticValidation.flags])),
  };
}

export function buildDeterministicPsychOutput(input: JsonRecord, reason: string): PsychAIOutput {
  return buildDeterministicPsychSemanticOutput(input, reason);
}

export function buildLegacyDeterministicPsychOutput(input: JsonRecord, reason: string): PsychAIOutput {
  const instruments = Array.isArray(input.instruments) ? input.instruments as JsonRecord[] : [];
  const quality = instruments
    .map((item) => `${String(item.code ?? "TEST")}: ${String((item.quality as JsonRecord | undefined)?.status ?? "REVISAR")}`)
    .join("; ");
  const evidence = instruments.map((item) =>
    `${String(item.code ?? "TEST")} con ${String(item.response_count ?? "-")} respuestas y hash ${String(item.result_sha256 ?? "no disponible").slice(0, 12)}`
  );
  return {
    version: "psych-ai-fallback-v1",
    executive_summary:
      `Interpretacion deterministica generada por el ERP porque el proveedor IA no quedo disponible (${reason}). Los resultados quedan como antecedente descriptivo para revision profesional.`,
    response_quality: quality || "Indicadores de calidad disponibles en el ERP.",
    strengths: [
      "Bateria completada y puntuada por reglas backend versionadas.",
      "Resultados disponibles para contrastar con entrevista.",
      "Trazabilidad de instrumentos, scoring y calidad preservada.",
    ],
    development_areas: [
      "Profundizar resultados extremos o de baja variabilidad.",
      "Cruzar patrones interpersonales con ejemplos laborales concretos.",
      "Revisar PRP junto con documentacion profesional disponible.",
    ],
    interview_questions: [
      "Describa una situacion reciente de presion laboral y como la resolvio.",
      "Como actua cuando una instruccion operacional entra en conflicto con la seguridad?",
      "Que senales le indican que debe pedir apoyo antes de continuar una tarea?",
      "Cuente una ocasion en que recibio retroalimentacion dificil.",
    ],
    ipip16: {
      summary: "IPIP-16 queda disponible como perfil de 16 dimensiones calculadas por el ERP.",
      clusters: {
        autocontrol_estabilidad: "Revisar estabilidad, tension, aprehension y cumplimiento como patrones conjuntos.",
        disciplina_estructura: "Revisar orden, normas y cautela frente a exigencias operativas.",
        interaccion_laboral: "Revisar calidez, sociabilidad, reserva y asertividad en contexto de equipo.",
        analisis_adaptacion: "Revisar apertura, imaginacion, aprendizaje y autosuficiencia.",
      },
    },
    ipc: {
      summary: "IPIP-IPC queda disponible como octantes y ejes continuos de calidez y dominancia.",
      predominant_profile: "Perfil predominante pendiente de revision profesional.",
      disc_disclaimer:
        "Este modelo interno no corresponde a DISC ni a Everything DiSC; usa octantes IPIP-IPC y macroestilos laborales propios.",
    },
    bis11: {
      summary: "BIS-11 informa un puntaje de impulsividad calculado por el ERP.",
      impulsivity_interpretation:
        "La impulsividad debe revisarse junto con entrevista, historial operacional y contexto del cargo.",
    },
    prp: {
      summary: "PRP conserva puntaje directo y factores documentados, sin inventar baremos no resueltos.",
      documentation_status: "Normas PRP permanecen sujetas a revision profesional cuando el material fuente sea ambiguo.",
    },
    integrated_analysis:
      "El analisis integrado debe combinar scores calculados, calidad de respuesta, perfil de cargo y entrevista. No se emite decision automatica.",
    preliminary_conclusion:
      "Conclusion preliminar no decisoria. Requiere revision profesional antes de utilizarse en el proceso.",
    limitations: [
      "No constituye diagnostico clinico.",
      "No constituye decision automatica de contratacion o rechazo.",
      "No reemplaza entrevista psicologica ni revision profesional.",
    ],
    evidence: evidence.length ? evidence.slice(0, 10) : [
      "Scores calculados por el ERP.",
      "Calidad de respuesta calculada por el ERP.",
      "Perfil de cargo versionado.",
      "Instrumentos completados por el candidato.",
    ],
  };
}
