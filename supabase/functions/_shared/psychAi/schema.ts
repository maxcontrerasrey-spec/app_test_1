import type { JsonRecord, PsychAIOutput } from "./types.ts";
import { normalizeSemanticOutputForErp, PSYCH_SEMANTIC_VERSION } from "./semantic.ts";

export const RESPONSE_SCHEMA_VERSION = "psych-ai-schema-v5";

const REQUIRED_TOP_LEVEL = [
  "executive_profile",
  "personality_profile",
  "interpersonal_profile",
  "safety_and_impulse_profile",
  "job_fit_analysis",
  "strengths",
  "points_to_explore",
  "interview_questions",
  "integrated_conclusion",
  "material_limitations",
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

function statementArray(value: unknown, min: number, max: number, fallback: Array<{ title: string; text: string }>) {
  const items = Array.isArray(value)
    ? value.map((item) => {
      const record = item && typeof item === "object" && !Array.isArray(item)
        ? item as Record<string, unknown>
        : {};
      const title = text(record.title, 160);
      const body = text(record.text, 700);
      return title || body ? { title, text: body } : null;
    }).filter(Boolean) as Array<{ title: string; text: string }>
    : [];
  return [...items, ...fallback].slice(0, Math.max(min, Math.min(max, items.length || fallback.length)));
}

function questionArray(value: unknown, min: number, max: number) {
  const fallback = [
    {
      question: "Describa una situación reciente de presión laboral y cómo la resolvió.",
      target: "Autorregulación y toma de decisiones bajo presión.",
    },
    {
      question: "Cuéntenos una ocasión en que debió cumplir un procedimiento aunque retrasara la tarea.",
      target: "Adherencia a normas y seguridad operacional.",
    },
    {
      question: "Relate una situación en que tuvo que coordinarse con otras personas para resolver un problema operacional.",
      target: "Cooperación, comunicación y coordinación.",
    },
    {
      question: "¿Qué hace cuando detecta una condición insegura o una instrucción poco clara?",
      target: "Criterio preventivo y escalamiento.",
    },
  ];
  const items = Array.isArray(value)
    ? value.map((item) => {
      const record = item && typeof item === "object" && !Array.isArray(item)
        ? item as Record<string, unknown>
        : {};
      const question = text(record.question, 360);
      const target = text(record.target, 220);
      return question ? { question, target } : null;
    }).filter(Boolean) as Array<{ question: string; target: string }>
    : [];
  return [...items, ...fallback].slice(0, Math.max(min, Math.min(max, items.length || fallback.length)));
}

function evidenceStatements(items: Array<{ title?: string; text?: string }>, evidenceId = "ev_semantic_context") {
  return items.map((item) => ({
    title: item.title || "",
    text: item.text || "",
    evidence_ids: [evidenceId],
  }));
}

export function normalizePsychAIOutput(value: unknown): PsychAIOutput {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  if ("executive_profile" in source || "personality_profile" in source || "safety_and_impulse_profile" in source) {
    const personality = source.personality_profile && typeof source.personality_profile === "object" && !Array.isArray(source.personality_profile)
      ? source.personality_profile as Record<string, unknown>
      : {};
    const interpersonal = source.interpersonal_profile && typeof source.interpersonal_profile === "object" && !Array.isArray(source.interpersonal_profile)
      ? source.interpersonal_profile as Record<string, unknown>
      : {};
    const safety = source.safety_and_impulse_profile && typeof source.safety_and_impulse_profile === "object" && !Array.isArray(source.safety_and_impulse_profile)
      ? source.safety_and_impulse_profile as Record<string, unknown>
      : {};
    const strengths = statementArray(source.strengths, 3, 5, [
      { title: "Trazabilidad preservada", text: "Batería completada y puntuada por reglas backend versionadas." },
      { title: "Base para entrevista", text: "Resultados disponibles para contrastar con entrevista y antecedentes laborales." },
      { title: "Lectura integrada", text: "El perfil debe analizarse junto con el contexto del cargo." },
    ]);
    const points = statementArray(source.points_to_explore, 2, 4, [
      { title: "Contraste conductual", text: "Profundizar los patrones relevantes mediante ejemplos laborales concretos." },
      { title: "Criterio profesional", text: "Revisar el resultado junto con antecedentes del proceso." },
    ]);
    const questions = questionArray(source.interview_questions, 3, 5);
    const executiveProfile = text(source.executive_profile) || "Interpretación integrada no disponible.";
    const jobFit = text(source.job_fit_analysis) || "El ajuste al cargo debe revisarse con entrevista y antecedentes del proceso.";
    const conclusion = text(source.integrated_conclusion) || "Conclusión preliminar no decisoria; requiere validación profesional.";
    const limitations = textArray(source.material_limitations, 0, 4, []);
    return {
      version: text(source.version, 80) || PSYCH_SEMANTIC_VERSION,
      executive_profile: executiveProfile,
      profile_summary: executiveProfile,
      executive_summary: executiveProfile,
      response_quality: "Adecuada. La calidad se basa en completitud y consistencia calculadas por el ERP; debe revisarse junto con los resultados.",
      strengths: strengths.map((item) => item.text || item.title).filter(Boolean),
      points_to_explore: evidenceStatements(points),
      development_areas: points.map((item) => item.text || item.title).filter(Boolean),
      interview_questions: questions.map((item) => item.question),
      instrument_analysis: {
        ipip16: text(personality.summary) || "Evaluación de Personalidad IPIP-16 interpretada descriptivamente.",
        ipip_ipc: text(interpersonal.summary) || "Evaluación Interpersonal IPIP-IPC interpretada como modelo laboral interno.",
        bis11: text(safety.bis11) || "BIS-11 interpretado según clasificación documentada.",
        prp: text(safety.prp) || "PRP interpretado descriptivamente desde puntaje directo y elementos documentados.",
      },
      ipip16: {
        summary: text(personality.summary) || "Perfil IPIP-16 disponible para revisión profesional.",
        clusters: {
          self_regulation: text(personality.self_regulation),
          discipline_structure: text(personality.discipline_structure),
          interpersonal_style: text(personality.interpersonal_style),
          adaptability_thinking: text(personality.adaptability_thinking),
        },
      },
      ipc: {
        summary: text(interpersonal.summary) || "IPIP-IPC describe patrones interpersonales laborales.",
        predominant_profile: text(interpersonal.initiative, 300) || "Perfil predominante integrado en el análisis interpersonal.",
        disc_disclaimer: "Modelo interpretativo laboral interno derivado de IPIP-IPC. No corresponde a Everything DiSC ni constituye equivalencia psicométrica validada.",
      },
      bis11: {
        summary: text(safety.summary) || "Perfil de seguridad e impulsividad disponible.",
        impulsivity_interpretation: text(safety.bis11) || text(safety.combined_interpretation),
      },
      prp: {
        summary: text(safety.prp) || "PRP disponible para lectura descriptiva.",
        documentation_status: text(safety.prp) || "Se interpretan solo score total y propiedades documentadas; no se inventan nombres de factores.",
      },
      personality_profile: {
        summary: text(personality.summary),
        self_regulation: text(personality.self_regulation),
        discipline_structure: text(personality.discipline_structure),
        interpersonal_style: text(personality.interpersonal_style),
        adaptability_thinking: text(personality.adaptability_thinking),
      },
      interpersonal_profile: {
        summary: text(interpersonal.summary),
        communication: text(interpersonal.communication),
        cooperation: text(interpersonal.cooperation),
        initiative: text(interpersonal.initiative),
        response_under_pressure: text(interpersonal.response_under_pressure),
      },
      safety_and_impulse_profile: {
        summary: text(safety.summary),
        bis11: text(safety.bis11),
        prp: text(safety.prp),
        combined_interpretation: text(safety.combined_interpretation),
      },
      job_fit_analysis: jobFit,
      integrated_analysis: [jobFit, text(safety.combined_interpretation)].filter(Boolean).join("\n\n"),
      preliminary_conclusion: conclusion,
      integrated_conclusion: conclusion,
      limitations,
      material_limitations: limitations,
      evidence: [],
    };
  }
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
