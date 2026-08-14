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
];

function collectStrings(value: unknown, out: string[] = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object") {
    Object.values(value as JsonRecord).forEach((item) => collectStrings(item, out));
  }
  return out;
}

function replaceProhibited(text: string) {
  let cleaned = text;
  cleaned = cleaned.replace(/\bno\s+apto\b/gi, "requiere revisión profesional");
  cleaned = cleaned.replace(/\bapto\b/gi, "sin decisión automática");
  cleaned = cleaned.replace(/\bno\s+contratar\b/gi, "profundizar antes de decidir");
  cleaned = cleaned.replace(/\bcontratar\b/gi, "evaluar en comité");
  cleaned = cleaned.replace(/\brechazar\b/gi, "observar profesionalmente");
  cleaned = cleaned.replace(/\bdescartar\b/gi, "observar profesionalmente");
  cleaned = cleaned.replace(/\bdiagn[oó]stic[oa]\b/gi, "descripción");
  cleaned = cleaned.replace(/\btrastorno\b/gi, "patrón observado");
  cleaned = cleaned.replace(/\bpercentil(?:es)?\b/gi, "referencia no disponible");
  cleaned = cleaned.replace(/\bbaremo chileno\b/gi, "baremo no disponible");
  cleaned = cleaned.replace(/\beneatipo\s+[0-9]\b/gi, "eneatipo no informado");
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

export function sanitizePsychAIInput(input: JsonRecord) {
  const cloned = structuredClone(input) as JsonRecord;
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

export function validateAndGuardPsychAIOutput(value: unknown, input?: JsonRecord): GuardrailResult {
  const shape = validateStrictShape(value);
  const semanticContext = input ? buildPsychSemanticContext(input) : null;
  const semanticValidation = semanticContext
    ? validatePsychSemanticOutput(value, semanticContext)
    : { ok: true, flags: [] };
  const normalized = semanticContext
    ? normalizeSemanticOutputForErp(sanitizeStrings(value), semanticContext)
    : normalizePsychAIOutput(sanitizeStrings(value));
  const guardrailFlags = collectStrings(normalized).flatMap((text) =>
    PROHIBITED_PATTERNS
      .filter(([pattern]) => pattern.test(text))
      .map(([, flag]) => flag)
  );

  normalized.limitations = Array.from(new Set([
    ...normalized.limitations,
    "No constituye diagnostico clinico.",
    "No constituye decision automatica de contratacion o rechazo.",
    "La revision profesional es obligatoria antes de usar este antecedente.",
  ])).slice(0, 8);
  normalized.version = normalized.version || PSYCH_SEMANTIC_VERSION;

  normalized.ipc.disc_disclaimer =
    "Este modelo interno no corresponde a DISC ni a Everything DiSC; usa octantes IPIP-IPC y macroestilos laborales propios.";

  return {
    output: normalized,
    validationFlags: [...shape.flags, ...semanticValidation.flags],
    guardrailFlags: Array.from(new Set([...guardrailFlags, ...semanticValidation.flags])),
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
