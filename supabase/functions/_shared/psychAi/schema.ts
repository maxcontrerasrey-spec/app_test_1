import type { JsonRecord, PsychAIOutput } from "./types.ts";
import { normalizeSemanticOutputForErp, PSYCH_SEMANTIC_VERSION } from "./semantic.ts";

export const RESPONSE_SCHEMA_VERSION = "psych-ai-schema-v3";

const REQUIRED_TOP_LEVEL = [
  "profile_summary",
  "strengths",
  "points_to_explore",
  "instrument_analysis",
  "integrated_analysis",
  "interview_questions",
  "preliminary_conclusion",
  "recommendations",
  "limitations",
] as const;

function text(value: unknown, max = 1400) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function textArray(value: unknown, min: number, max: number, fallback: string[]) {
  const items = Array.isArray(value)
    ? value.map((item) => text(item, 320)).filter(Boolean)
    : [];
  const merged = [...items, ...fallback].filter(Boolean);
  return merged.slice(0, Math.max(min, Math.min(max, merged.length)));
}

function textRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const cleaned = text(item, 600);
    if (cleaned) result[key.slice(0, 80)] = cleaned;
  }
  return result;
}

export function normalizePsychAIOutput(value: unknown): PsychAIOutput {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  if ("profile_summary" in source || "points_to_explore" in source || "instrument_analysis" in source) {
    return normalizeSemanticOutputForErp(source);
  }
  const ipip16 = source.ipip16 && typeof source.ipip16 === "object" && !Array.isArray(source.ipip16)
    ? source.ipip16 as Record<string, unknown>
    : {};
  const ipc = source.ipc && typeof source.ipc === "object" && !Array.isArray(source.ipc)
    ? source.ipc as Record<string, unknown>
    : {};
  const bis11 = source.bis11 && typeof source.bis11 === "object" && !Array.isArray(source.bis11)
    ? source.bis11 as Record<string, unknown>
    : {};
  const prp = source.prp && typeof source.prp === "object" && !Array.isArray(source.prp)
    ? source.prp as Record<string, unknown>
    : {};

  return {
    version: text(source.version, 80) || PSYCH_SEMANTIC_VERSION,
    executive_summary: text(source.executive_summary) || "Interpretación preliminar no disponible.",
    response_quality: text(source.response_quality) || "La calidad debe revisarse junto con los indicadores calculados por el ERP.",
    strengths: textArray(source.strengths, 3, 6, [
      "Mantener revisión profesional de resultados.",
      "Cruzar resultados con entrevista y antecedentes del proceso.",
      "Considerar el contexto del cargo antes de cualquier decisión.",
    ]),
    development_areas: textArray(source.development_areas, 3, 6, [
      "Profundizar patrones relevantes en entrevista.",
      "Revisar consistencia entre instrumentos.",
      "Evitar conclusiones automáticas basadas solo en test.",
    ]),
    interview_questions: textArray(source.interview_questions, 4, 8, [
      "Describa una situación reciente de presión laboral y cómo la resolvió.",
      "¿Cómo actúa cuando una instrucción operacional entra en conflicto con la seguridad?",
      "¿Qué señales le indican que debe pedir apoyo antes de continuar una tarea?",
      "Cuéntenos de una ocasión en que recibió retroalimentación difícil.",
    ]),
    ipip16: {
      summary: text(ipip16.summary) || "IPIP-16 requiere interpretación profesional complementaria.",
      clusters: textRecord(ipip16.clusters),
    },
    ipc: {
      summary: text(ipc.summary) || "IPIP-IPC describe patrones interpersonales, no equivalentes a DISC.",
      predominant_profile: text(ipc.predominant_profile, 300) || "Perfil predominante pendiente de revisión.",
      disc_disclaimer: text(ipc.disc_disclaimer, 400) ||
        "Este modelo interno no corresponde a DISC ni a Everything DiSC.",
    },
    bis11: {
      summary: text(bis11.summary) || "BIS-11 se informa como antecedente de impulsividad.",
      impulsivity_interpretation: text(bis11.impulsivity_interpretation) ||
        "La impulsividad debe revisarse junto con entrevista y antecedentes.",
    },
    prp: {
      summary: text(prp.summary) || "PRP conserva salida documentada y revisión profesional.",
      documentation_status: text(prp.documentation_status, 500) ||
        "Baremos y factores sujetos a documentación disponible.",
    },
    integrated_analysis: text(source.integrated_analysis) ||
      "Análisis integrado pendiente de revisión profesional.",
    preliminary_conclusion: text(source.preliminary_conclusion) ||
      "Conclusión preliminar no decisoria; requiere validación profesional.",
    limitations: textArray(source.limitations, 3, 8, [
      "No constituye diagnóstico clínico.",
      "No constituye decisión automática de contratación o rechazo.",
      "No reemplaza entrevista psicolaboral ni revisión profesional.",
    ]),
    evidence: textArray(source.evidence, 4, 10, [
      "Scores calculados por el ERP.",
      "Calidad de respuesta calculada por el ERP.",
      "Perfil de cargo versionado.",
      "Instrumentos completados por el candidato.",
    ]),
  };
}

export function validateStrictShape(value: unknown) {
  const flags: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, flags: ["output_not_object"] };
  }
  const record = value as JsonRecord;
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in record)) flags.push(`missing_${key}`);
  }
  for (const key of Object.keys(record)) {
    if (!REQUIRED_TOP_LEVEL.includes(key as typeof REQUIRED_TOP_LEVEL[number])) {
      flags.push(`unexpected_${key}`);
    }
  }
  return { ok: flags.length === 0, flags };
}
