import type { JsonRecord, PsychAIOutput } from "./types.ts";

export const PSYCH_SEMANTIC_VERSION = "psych-semantic-guardrails-v3";

type Direction = "HIGHER_MORE" | "HIGHER_LESS" | "BIPOLAR" | "UNKNOWN";
type InterpretationMode = "THEORETICAL_RANGE" | "DOCUMENTED_CLASSIFICATION" | "PROFESSIONAL_ONLY";
type SemanticLevel =
  | "MUY_BAJO_EN_RANGO_TEORICO"
  | "BAJO_EN_RANGO_TEORICO"
  | "INTERMEDIO_EN_RANGO_TEORICO"
  | "ALTO_EN_RANGO_TEORICO"
  | "MUY_ALTO_EN_RANGO_TEORICO"
  | "DOCUMENTED_CLASSIFICATION"
  | "PROFESSIONAL_ONLY";

export type PsychDimensionMetadata = {
  instrument: string;
  dimension: string;
  label: string;
  theoreticalMin: number;
  theoreticalMax: number;
  direction: Direction;
  interpretationMode: InterpretationMode;
  allowedDescriptors: string[];
  prohibitedDescriptors: string[];
  version: string;
};

export type PsychEvidence = {
  id: string;
  instrument: string;
  dimension?: string;
  label?: string;
  score?: number;
  classification?: string;
  semanticLevel?: SemanticLevel | string;
  direction?: Direction;
  sourceVersion: string;
  maxAllowedIntensity?: string;
  interpretationStatus?: InterpretationMode;
};

export type EvidenceBackedStatement = {
  title?: string;
  text?: string;
  question?: string;
  target?: string;
  evidence_ids: string[];
};

export type PsychSemanticContext = {
  version: string;
  evidence_catalog: PsychEvidence[];
  locks: {
    ipip_level_disclaimer: string;
    bis11?: {
      score: number;
      classification: string;
      max_allowed_classification: string;
    };
    prp?: {
      score: number;
      interpretation_status: "DESCRIPTIVE_INTERPRETATION" | "PROFESSIONAL_ONLY";
      automatic_interpretation_allowed: boolean;
      allowed_statement: string;
    };
    ipc?: {
      macrostyles: Array<{ label: string; score: number; rank: number }>;
      prohibited_statement: string;
    };
  };
  prohibited_terms: string[];
  neutral_interview_examples: string[];
};

export type PsychSemanticValidation = {
  ok: boolean;
  flags: string[];
};

const IPIP_DIMENSION_LABELS: Record<string, string> = {
  APE: "Apertura a ideas y cambio",
  APR: "Aprensión",
  ASE: "Asertividad",
  AUT: "Autosuficiencia",
  CAL: "Calidez interpersonal",
  NOR: "Cumplimiento de normas",
  CUM: "Cumplimiento de normas",
  CAU: "Cautela interpersonal",
  DES: "Cautela interpersonal",
  EST: "Estabilidad emocional",
  GRE: "Sociabilidad grupal",
  IMA: "Imaginación",
  ANA: "Análisis y aprendizaje",
  ORD: "Orden y perfeccionismo",
  RES: "Reserva personal",
  SEG: "Seguridad social",
  SEN: "Sensibilidad estética y emocional",
  TEN: "Tensión e irritabilidad",
};

const IPIP_METADATA: PsychDimensionMetadata[] = Object.entries(IPIP_DIMENSION_LABELS).map(([dimension, label]) => ({
  instrument: "IPIP16_105",
  dimension,
  label,
  theoreticalMin: 1,
  theoreticalMax: 5,
  direction: "UNKNOWN",
  interpretationMode: "THEORETICAL_RANGE",
  allowedDescriptors: [
    "nivel descriptivo relativo al rango teorico",
    "intermedio en rango teorico",
    "alto en rango teorico",
    "bajo en rango teorico",
  ],
  prohibitedDescriptors: [
    "percentil",
    "promedio poblacional",
    "deficiente",
    "critico",
    "severo",
  ],
  version: "ipip-theoretical-level-v1",
}));

const RISK_TERMS = [
  "riesgo critico",
  "riesgo crítico",
  "alto riesgo",
  "riesgo severo",
  "peligroso",
  "inseguro",
  "no recomendable",
  "incompatible",
  "intervencion obligatoria",
  "intervención obligatoria",
  "requiere intervencion",
  "requiere intervención",
  "debe mejorar antes de ser considerado",
];

const METHODOLOGICAL_STRENGTH_TERMS = [
  "mantener revision",
  "mantener revisión",
  "revisar",
  "cruzar resultados",
  "considerar contexto",
  "considerar el contexto",
  "validar",
  "profundizar",
  "realizar entrevista",
];

const ESCALATION_TERMS = [
  "alta",
  "alto",
  "elevada",
  "elevado",
  "marcada",
  "marcado",
  "deficiente",
  "critica",
  "crítica",
  "critico",
  "crítico",
  "severa",
  "severo",
  "baja",
  "bajo",
];

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

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const RECOMMENDATIONS = new Set([
  "RECOMENDADO",
  "RECOMENDADO_CON_OBSERVACIONES",
  "REQUIERE_PROFUNDIZACION",
  "NO_RECOMENDADO",
]);

const CONFIDENCES = new Set(["BAJA", "MEDIA", "ALTA"]);

function normalizeRecommendation(value: unknown) {
  const raw = readText(value, "REQUIERE_PROFUNDIZACION").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (raw === "RECOMENDADO_CON_OBSERVACION") return "RECOMENDADO_CON_OBSERVACIONES";
  return RECOMMENDATIONS.has(raw) ? raw as PsychAIOutput["recommendation"] : "REQUIERE_PROFUNDIZACION";
}

function normalizeConfidence(value: unknown) {
  const raw = readText(value, "MEDIA").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return CONFIDENCES.has(raw) ? raw as PsychAIOutput["recommendation_confidence"] : "MEDIA";
}

function textList(value: unknown, max: number) {
  return asArray(value).map((item) => readText(item)).filter(Boolean).slice(0, max);
}

function containsAny(text: string, terms: string[]) {
  const normalized = normalizeText(text);
  return terms.some((term) => {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm.includes(" ")) {
      const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`).test(normalized);
    }
    return normalized.includes(normalizedTerm);
  });
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function classifyIpipTheoreticalLevel(score: number): SemanticLevel {
  if (score <= 1.79) return "MUY_BAJO_EN_RANGO_TEORICO";
  if (score <= 2.59) return "BAJO_EN_RANGO_TEORICO";
  if (score <= 3.40) return "INTERMEDIO_EN_RANGO_TEORICO";
  if (score <= 4.20) return "ALTO_EN_RANGO_TEORICO";
  return "MUY_ALTO_EN_RANGO_TEORICO";
}

function maxIntensityForLevel(level: SemanticLevel | string) {
  if (level === "INTERMEDIO_EN_RANGO_TEORICO") return "INTERMEDIATE_ONLY";
  if (level === "BAJO_EN_RANGO_TEORICO" || level === "ALTO_EN_RANGO_TEORICO") return "MODERATE_DESCRIPTOR_ONLY";
  if (level === "MUY_BAJO_EN_RANGO_TEORICO" || level === "MUY_ALTO_EN_RANGO_TEORICO") return "THEORETICAL_RANGE_DESCRIPTOR";
  return String(level);
}

function getInstrument(input: JsonRecord, code: string) {
  return asArray(input.instruments).map(asRecord).find((item) => item.code === code);
}

function dimensionEntries(result: JsonRecord) {
  const dimensions = asRecord(result.dimensions);
  return Object.entries(dimensions).map(([code, value]) => {
    const item = asRecord(value);
    return {
      code,
      label: readText(item.name, IPIP_DIMENSION_LABELS[code] ?? code),
      score: readNumber(item.mean ?? item.score),
    };
  }).filter((entry) => entry.score !== null) as Array<{ code: string; label: string; score: number }>;
}

function ipcMacrostyleEntries(result: JsonRecord) {
  const laborProfile = asRecord(result.labor_profile);
  const styles = asRecord(laborProfile.styles);
  return Object.entries(styles)
    .map(([label, value]) => ({ label, score: readNumber(value) }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((entry, index) => ({ label: entry.label, score: entry.score ?? 0, rank: index + 1 }));
}

function normalizeClassification(value: unknown) {
  const raw = normalizeText(readText(value)).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (raw.includes("sobre") && raw.includes("promedio")) return "SOBRE_EL_PROMEDIO";
  if (raw.includes("promedio")) return "PROMEDIO";
  if (raw.includes("bajo")) return "BAJO_EL_PROMEDIO";
  return raw.toUpperCase() || "SIN_CLASIFICACION";
}

export function buildPsychSemanticContext(input: JsonRecord): PsychSemanticContext {
  const evidence: PsychEvidence[] = [];
  const ipip = getInstrument(input, "IPIP16_105");
  if (ipip) {
    const result = asRecord(ipip.result);
    for (const entry of dimensionEntries(result)) {
      const metadata = IPIP_METADATA.find((item) => item.dimension === entry.code);
      const semanticLevel = classifyIpipTheoreticalLevel(entry.score);
      evidence.push({
        id: `ev_ipip16_${entry.code}`,
        instrument: "IPIP16_105",
        dimension: entry.code,
        label: entry.label,
        score: Number(entry.score.toFixed(2)),
        semanticLevel,
        direction: metadata?.direction ?? "UNKNOWN",
        sourceVersion: metadata?.version ?? "ipip-theoretical-level-v1",
        maxAllowedIntensity: maxIntensityForLevel(semanticLevel),
        interpretationStatus: "THEORETICAL_RANGE",
      });
    }
  }

  const ipc = getInstrument(input, "IPIP_IPC_32");
  const ipcStyles = ipc ? ipcMacrostyleEntries(asRecord(ipc.result)) : [];
  for (const style of ipcStyles) {
    evidence.push({
      id: `ev_ipc_style_${normalizeText(style.label).replace(/[^a-z0-9]+/g, "_")}`,
      instrument: "IPIP_IPC_32",
      dimension: style.label,
      label: style.label,
      score: Number(style.score.toFixed(2)),
      semanticLevel: style.rank === 1 ? "DOCUMENTED_CLASSIFICATION" : "THEORETICAL_RANGE",
      direction: "UNKNOWN",
      sourceVersion: "ipc-macrostyle-v1",
      maxAllowedIntensity: style.rank === 1 ? "PREDOMINANT_ONLY" : "ORDERED_STYLE_ONLY",
      interpretationStatus: "THEORETICAL_RANGE",
    });
  }

  const bis11 = getInstrument(input, "BARRATT_BIS11_30");
  const bisResult = asRecord(bis11?.result);
  const bisScore = readNumber(bisResult.total);
  const bisClassification = normalizeClassification(bisResult.classification);
  if (bis11 && bisScore !== null) {
    evidence.push({
      id: "ev_bis11_total",
      instrument: "BARRATT_BIS11_30",
      score: bisScore,
      classification: bisClassification,
      semanticLevel: "DOCUMENTED_CLASSIFICATION",
      direction: "UNKNOWN",
      sourceVersion: "bis11-classification-lock-v1",
      maxAllowedIntensity: bisClassification,
      interpretationStatus: "DOCUMENTED_CLASSIFICATION",
    });
  }

  const prp = getInstrument(input, "PRP_EMAIL_FORM_A_30");
  const prpResult = asRecord(prp?.result);
  const prpScore = readNumber(prpResult.raw_total);
  if (prp && prpScore !== null) {
    evidence.push({
      id: "ev_prp_total",
      instrument: "PRP_EMAIL_FORM_A_30",
      score: prpScore,
      semanticLevel: "DOCUMENTED_CLASSIFICATION",
      direction: "UNKNOWN",
      sourceVersion: "prp-descriptive-method-v5",
      maxAllowedIntensity: "DESCRIPTIVE_PREVENTIVE_PATTERN",
      interpretationStatus: "DOCUMENTED_CLASSIFICATION",
    });
  }

  return {
    version: PSYCH_SEMANTIC_VERSION,
    evidence_catalog: evidence,
    locks: {
      ipip_level_disclaimer:
        "Nivel descriptivo relativo al rango teorico; no corresponde a percentil ni comparacion poblacional.",
      bis11: bisScore === null ? undefined : {
        score: bisScore,
        classification: bisClassification,
        max_allowed_classification: bisClassification,
      },
      prp: prpScore === null ? undefined : {
        score: prpScore,
        interpretation_status: "PROFESSIONAL_ONLY",
        automatic_interpretation_allowed: false,
        allowed_statement:
          "PRP se conserva como antecedente descriptivo calculado por el ERP. Sin semántica/baremos documentados suficientes, su peso decisional automático es 0 y no debe modificar la recomendación preliminar.",
      },
      ipc: ipcStyles.length ? {
        macrostyles: ipcStyles,
        prohibited_statement:
          "No describir Directivo como tendencia secundaria salvo que ocupe el segundo lugar deterministico.",
      } : undefined,
    },
    prohibited_terms: [
      ...RISK_TERMS,
      "por debajo del promedio",
      "por encima del promedio",
      "alta apertura",
      "baja adherencia",
      "irritabilidad sostenida",
    ],
    neutral_interview_examples: [
      "Describame una situacion durante la conduccion en la que tuvo que tomar una decision rapidamente bajo presion. Que alternativas considero y como decidio?",
      "Cuenteme una situacion de presion o conflicto durante una jornada laboral. Como reacciono y que hizo para resolverla?",
    ],
  };
}

export function attachPsychSemanticContext(input: JsonRecord) {
  const semantic_context = buildPsychSemanticContext(input);
  return {
    ...input,
    methodology: {
      version: "psych-methodology-v5",
      instruments: {
        IPIP16_105: {
          professional_name: "Evaluación de Personalidad IPIP-16",
          source_type: "selección/adaptación interna basada en ítems IPIP de uso libre",
          implementation_type: "reemplazo funcional no propietario del 16PF",
          scoring: "media 1-5 por dimensión calculada por ERP",
          interpretation: "descriptiva por dimensiones y clusters laborales internos",
          normative_benchmark: null,
          restrictions: [
            "no atribuir a 16PF propietario",
            "no usar baremos 16PF",
            "no presentar percentiles poblacionales",
          ],
          clusters: {
            self_regulation: ["Estabilidad emocional", "Aprensión", "Tensión e irritabilidad", "Cautela interpersonal", "Cumplimiento de normas"],
            discipline_structure: ["Orden y perfeccionismo", "Cumplimiento de normas", "Análisis y aprendizaje", "Cautela interpersonal"],
            interpersonal_style: ["Calidez interpersonal", "Sociabilidad grupal", "Asertividad", "Reserva personal", "Seguridad social"],
            adaptability_thinking: ["Apertura a ideas y cambio", "Imaginación", "Análisis y aprendizaje", "Autosuficiencia"],
          },
        },
        IPIP_IPC_32: {
          professional_name: "Evaluación Interpersonal IPIP-IPC",
          source_type: "IPIP-IPC de uso libre",
          implementation_type: "reemplazo funcional laboral interno del flujo DISC",
          scoring: "octantes, ejes continuos de calidez/dominancia y macroestilos internos",
          interpretation: "estilo relacional, influencia, cooperación, iniciativa y respuesta bajo presión",
          normative_benchmark: null,
          disclaimer: "Modelo interpretativo laboral interno derivado de IPIP-IPC. No corresponde a Everything DiSC ni constituye equivalencia psicométrica validada.",
        },
        BARRATT_BIS11_30: {
          professional_name: "Barratt BIS-11",
          source_type: "instrumento recibido y digitalizado desde correo fuente",
          scoring: "puntaje total y clasificación documentada calculada por ERP",
          interpretation: "contextual, conservando literalmente la clasificación documentada",
          restrictions: ["no escalar SOBRE_EL_PROMEDIO a alto, crítico ni severo"],
        },
        PRP_EMAIL_FORM_A_30: {
          professional_name: "Escala P.R.P",
          source_type: "documento y corrector recibidos por correo",
          scoring: "30 ítems, dirección positiva/negativa, score total y factores técnicos F1-F6 calculados por ERP",
          automatic_interpretation_allowed: false,
          decision_weight: 0,
          interpretation: "antecedente descriptivo sin peso decisional automático mientras no exista semántica/baremos suficientemente documentados",
          restrictions: [
            "no inventar nombres de factores F1-F6",
            "no usar percentiles, eneatipos ni grupos normativos si no vienen documentados en el payload",
            "no emitir clasificación de riesgo no documentada",
          ],
        },
      },
      professional_report_rules: {
        avoid_internal_codes: true,
        single_methodological_notice:
          "Los resultados representan antecedentes complementarios de evaluación psicolaboral y deben ser considerados junto con entrevista, antecedentes laborales y demás información del proceso. No constituyen diagnóstico clínico ni una decisión automática de contratación.",
      },
    },
    semantic_context,
    constraints: {
      ...asRecord(input.constraints),
      semantic_guardrails_version: PSYCH_SEMANTIC_VERSION,
      llm_must_use_evidence_ids: false,
      llm_must_not_infer_intensity: true,
      prp_descriptive_interpretation_allowed: false,
      prp_decision_weight: 0,
    },
  };
}

function statementText(statement: unknown) {
  const item = asRecord(statement);
  return [item.title, item.text, item.question, item.target].map((value) => readText(value)).filter(Boolean).join(" ");
}

function readEvidenceIds(statement: unknown) {
  return asArray(asRecord(statement).evidence_ids).map((item) => readText(item)).filter(Boolean);
}

function statementsFromOutput(output: JsonRecord): EvidenceBackedStatement[] {
  const v5Strengths = asArray(output.strengths).map(asRecord);
  const v5Points = asArray(output.points_to_explore).map(asRecord);
  const v5Questions = asArray(output.interview_questions).map(asRecord);
  return [
    ...v5Strengths,
    ...v5Points,
    ...v5Questions,
  ] as EvidenceBackedStatement[];
}

export function deduplicateLimitations(limitations: unknown): string[] {
  return unique(asArray(limitations).map((item) => readText(item, "")).filter(Boolean).map((item) => item.trim()))
    .slice(0, 8);
}

function fallbackEvidence(context: PsychSemanticContext, instrument: string) {
  return context.evidence_catalog.find((item) => item.instrument === instrument)?.id ??
    context.evidence_catalog[0]?.id ??
    "ev_semantic_context";
}

function displayFallbackReason(reason: string) {
  const normalized = normalizeText(reason);
  if (normalized.includes("429") || normalized.includes("rate limit")) {
    return "proveedor IA temporalmente limitado";
  }
  if (normalized.includes("timeout")) {
    return "tiempo de respuesta agotado";
  }
  if (normalized.includes("missing_openai_api_key") || normalized.includes("feature_flag_disabled")) {
    return "proveedor IA no habilitado";
  }
  if (normalized.includes("semantic_validation_failed")) {
    return "salida IA no aprobo validacion semantica";
  }
  return "proveedor IA no disponible temporalmente";
}

export function buildDeterministicPsychSemanticOutput(
  input: JsonRecord,
  reason: string,
): PsychAIOutput {
  const context = buildPsychSemanticContext(input);
  const ipipIntermediate = context.evidence_catalog.filter((item) =>
    item.instrument === "IPIP16_105" && item.semanticLevel === "INTERMEDIO_EN_RANGO_TEORICO"
  );
  const cal = context.evidence_catalog.find((item) => item.id === "ev_ipip16_CAL");
  const ord = context.evidence_catalog.find((item) => item.id === "ev_ipip16_ORD");
  const nor = context.evidence_catalog.find((item) => item.id === "ev_ipip16_CUM") ??
    context.evidence_catalog.find((item) => item.id === "ev_ipip16_NOR");
  const bis = context.locks.bis11;
  const prp = context.locks.prp;
  const ipc = context.locks.ipc?.macrostyles ?? [];
  const predominant = ipc[0];
  const second = ipc[1];

  const strengths = [
    cal ? {
      title: "Calidez interpersonal en rango teorico alto",
      text: `Calidez interpersonal registra ${cal.score}/5, nivel ${cal.semanticLevel}; se informa como descriptor teorico, no como percentil.`,
      evidence_ids: [cal.id],
    } : null,
    ord ? {
      title: "Orden y estructura en rango teorico intermedio",
      text: `Orden y perfeccionismo registra ${ord.score}/5 en nivel descriptivo intermedio del rango teorico.`,
      evidence_ids: [ord.id],
    } : null,
    predominant ? {
      title: `Macroestilo interpersonal predominante ${predominant.label}`,
      text: `${predominant.label} es el macroestilo de mayor puntaje (${predominant.score}). ${second ? `${second.label} aparece en segundo lugar (${second.score}).` : ""}`,
      evidence_ids: [fallbackEvidence(context, "IPIP_IPC_32")],
    } : null,
  ].filter(Boolean) as EvidenceBackedStatement[];

  const points = [
    nor ? {
      title: "Adherencia normativa a profundizar por criticidad del cargo",
      text:
        `Cumplimiento de normas registra ${nor.score}/5, nivel descriptivo intermedio del rango teorico. Dada su criticidad para conduccion operacional, corresponde profundizar con entrevista conductual y antecedentes de desempeño, sin clasificarlo como deficit.`,
      evidence_ids: [nor.id],
    } : null,
    bis ? {
      title: "Impulsividad como antecedente a contrastar",
      text:
        `BIS-11 obtiene ${bis.score}, con clasificacion deterministica ${bis.classification}. Se conserva esa intensidad y se sugiere profundizarla por el contexto del cargo.`,
      evidence_ids: ["ev_bis11_total"],
    } : null,
    prp ? {
      title: "PRP pendiente de interpretacion profesional",
      text: prp.allowed_statement,
      evidence_ids: ["ev_prp_total"],
    } : null,
  ].filter(Boolean) as EvidenceBackedStatement[];

  const v5 = {
    version: PSYCH_SEMANTIC_VERSION,
    recommendation: bis ? "REQUIERE_PROFUNDIZACION" : "RECOMENDADO_CON_OBSERVACIONES",
    recommendation_confidence: "MEDIA",
    critical_strengths: [],
    critical_gaps: [],
    critical_uncertainties: [
      ...(bis ? ["Impulsividad medida por BIS-11 debe contrastarse por su criticidad para conducción operacional."] : []),
      ...(nor ? ["Cumplimiento de normas en rango descriptivo intermedio no constituye fortaleza; requiere corroboración conductual por criticidad del cargo."] : []),
    ],
    decision_rationale:
      "La recomendación preliminar automatizada se basa en compatibilidad entre resultados psicométricos y criticidades del cargo. PRP se conserva como antecedente descriptivo sin peso decisional automático.",
    executive_profile:
      `Informe generado con guardrails semanticos determinísticos porque el ${displayFallbackReason(reason)}. La lectura integra resultados descriptivos disponibles y debe validarse profesionalmente.`,
    personality_profile: {
      summary:
        `IPIP-16 se informa con niveles descriptivos relativos al rango teorico 1-5. ${ipipIntermediate.length} dimensiones se ubican en nivel intermedio; no corresponde hablar de promedio poblacional sin baremo documentado.`,
      self_regulation: "Revisar estabilidad emocional, tension, aprension, cautela y cumplimiento como patron conjunto de autorregulacion laboral.",
      discipline_structure: "Revisar orden, cumplimiento de normas, analisis y cautela como soporte de estructura operacional.",
      interpersonal_style: "Revisar calidez, sociabilidad, reserva y asertividad en contexto de trato laboral y coordinacion.",
      adaptability_thinking: "Revisar apertura, imaginacion, aprendizaje y autosuficiencia como antecedentes de adaptacion y criterio.",
    },
    interpersonal_profile: {
      summary: predominant
        ? `IPIP-IPC muestra predominancia ${predominant.label}${second ? ` y segundo macroestilo ${second.label}` : ""}, dentro de un modelo laboral interno no equivalente a DISC.`
        : "IPIP-IPC disponible para interpretar octantes y macroestilos laborales internos.",
      communication: "Contrastar el estilo comunicacional con ejemplos de coordinacion, pasajeros, supervision y equipo.",
      cooperation: "Analizar cooperacion y orientacion interpersonal desde el patron IPIP-IPC observado.",
      initiative: predominant ? `El macroestilo principal observado es ${predominant.label}.` : "Iniciativa a revisar en entrevista.",
      response_under_pressure: "Explorar respuesta bajo presion sin convertir la criticidad del cargo en severidad del resultado.",
    },
    safety_and_impulse_profile: {
      summary: "La integracion de seguridad conductual cruza BIS-11, PRP y dimensiones IPIP vinculadas a normas, cautela y estabilidad.",
      bis11: bis
        ? `El resultado BIS-11 obtiene ${bis.score} y se encuentra clasificado como ${bis.classification.toLowerCase().replaceAll("_", " ")} segun el criterio documentado.`
        : "BIS-11 disponible para revision profesional.",
      prp: prp?.allowed_statement ??
        "PRP disponible solo como antecedente descriptivo si el puntaje esta calculado por el ERP.",
      combined_interpretation:
        "La lectura integrada separa criticidad del cargo de severidad del resultado; los hallazgos deben contrastarse con entrevista, antecedentes laborales y criterio profesional.",
    },
    job_fit_analysis:
      "El ajuste al cargo debe revisarse desde el patron conjunto de autorregulacion, normas, trato laboral, impulsividad y orientacion preventiva, sin emitir decision automatica.",
    strengths,
    points_to_explore: points,
    interview_questions: [
      {
        question:
          "Describame una situacion durante la conduccion en la que tuvo que tomar una decision rapidamente bajo presion. Que alternativas considero y como decidio?",
        target: "Toma de decisiones bajo presion sin presuponer deficit.",
        evidence_ids: bis ? ["ev_bis11_total"] : [fallbackEvidence(context, "IPIP16_105")],
      },
      {
        question:
          "Cuenteme una situacion de presion o conflicto durante una jornada laboral. Como reacciono y que hizo para resolverla?",
        target: "Regulacion conductual en contexto laboral.",
        evidence_ids: [fallbackEvidence(context, "IPIP16_105")],
      },
      {
        question:
          "Relate una ocasion en que una instruccion operacional requirio especial atencion a normas o procedimientos. Como verifico su cumplimiento?",
        target: "Adherencia a normas en tarea operacional relevante.",
        evidence_ids: nor ? [nor.id] : [fallbackEvidence(context, "IPIP16_105")],
      },
      {
        question:
          "Describa una situacion en que debio coordinarse con pasajeros, equipo o supervision para resolver una dificultad operacional.",
        target: "Interaccion laboral y coordinacion.",
        evidence_ids: [fallbackEvidence(context, "IPIP_IPC_32")],
      },
    ],
    integrated_conclusion:
      "Conclusión preliminar no decisoria. Los tests no determinan aptitud por si solos; el resultado debe revisarse profesionalmente junto con entrevista y antecedentes del proceso.",
    material_limitations: deduplicateLimitations([
      "Los resultados representan antecedentes complementarios de evaluación psicolaboral y deben considerarse junto con entrevista, antecedentes laborales y demás información del proceso. No constituyen diagnóstico clínico ni una decisión automática de contratación.",
    ]),
  };

  return v5 as unknown as PsychAIOutput;
}

function arrayText(items: EvidenceBackedStatement[]) {
  return items.map((item) => item.text || item.question || item.title || "").filter(Boolean);
}

export function normalizeSemanticOutputForErp(value: unknown, context?: PsychSemanticContext): PsychAIOutput {
  const source = asRecord(value);
  if ("executive_profile" in source || "personality_profile" in source || "safety_and_impulse_profile" in source) {
    const personality = asRecord(source.personality_profile);
    const interpersonal = asRecord(source.interpersonal_profile);
    const safety = asRecord(source.safety_and_impulse_profile);
    const strengths = asArray(source.strengths).map(asRecord);
    const points = asArray(source.points_to_explore).map(asRecord);
    const questions = asArray(source.interview_questions).map(asRecord);
    const executive = readText(source.executive_profile, "Interpretacion integrada no disponible.");
    const jobFit = readText(source.job_fit_analysis, "Ajuste al cargo pendiente de revision profesional.");
    const conclusion = readText(source.integrated_conclusion, "Conclusion preliminar no decisoria.");
    const limitations = deduplicateLimitations(source.material_limitations);
    const prpText = readText(safety.prp, "PRP se interpreta descriptivamente solo desde propiedades documentadas.");
    const bisText = readText(safety.bis11, "BIS-11 se informa segun clasificacion documentada.");
    const ipcText = readText(interpersonal.summary, "IPIP-IPC describe octantes y macroestilos propios; no corresponde a DISC.");
    const ipipText = readText(personality.summary, "IPIP-16 usa niveles descriptivos relativos al rango teorico.");
    return {
      version: readText(source.version, PSYCH_SEMANTIC_VERSION),
      recommendation: normalizeRecommendation(source.recommendation),
      recommendation_confidence: normalizeConfidence(source.recommendation_confidence),
      critical_strengths: textList(source.critical_strengths, 4),
      critical_gaps: textList(source.critical_gaps, 4),
      critical_uncertainties: textList(source.critical_uncertainties, 5),
      decision_rationale: readText(source.decision_rationale, conclusion),
      executive_profile: executive,
      profile_summary: executive,
      executive_summary: executive,
      response_quality:
        "Adecuada. La calidad se basa en completitud y consistencia calculadas por el ERP; debe revisarse junto con los resultados.",
      strengths: arrayText(strengths as EvidenceBackedStatement[]),
      points_to_explore: points as EvidenceBackedStatement[],
      development_areas: arrayText(points as EvidenceBackedStatement[]),
      interview_questions: questions.map((item) => readText(item.question, readText(item.text))).filter(Boolean),
      instrument_analysis: {
        ipip16: ipipText,
        ipip_ipc: ipcText,
        bis11: bisText,
        prp: prpText,
      },
      ipip16: {
        summary: ipipText,
        clusters: {
          self_regulation: readText(personality.self_regulation),
          discipline_structure: readText(personality.discipline_structure),
          interpersonal_style: readText(personality.interpersonal_style),
          adaptability_thinking: readText(personality.adaptability_thinking),
        },
      },
      ipc: {
        summary: ipcText,
        predominant_profile: readText(interpersonal.initiative, "Perfil interpersonal integrado en el analisis."),
        disc_disclaimer:
          "Modelo interpretativo laboral interno derivado de IPIP-IPC. No corresponde a Everything DiSC ni constituye equivalencia psicométrica validada.",
      },
      bis11: {
        summary: readText(safety.summary, bisText),
        impulsivity_interpretation: bisText,
      },
      prp: {
        summary: prpText,
        documentation_status: prpText,
      },
      personality_profile: {
        summary: ipipText,
        self_regulation: readText(personality.self_regulation),
        discipline_structure: readText(personality.discipline_structure),
        interpersonal_style: readText(personality.interpersonal_style),
        adaptability_thinking: readText(personality.adaptability_thinking),
      },
      interpersonal_profile: {
        summary: ipcText,
        communication: readText(interpersonal.communication),
        cooperation: readText(interpersonal.cooperation),
        initiative: readText(interpersonal.initiative),
        response_under_pressure: readText(interpersonal.response_under_pressure),
      },
      safety_and_impulse_profile: {
        summary: readText(safety.summary),
        bis11: bisText,
        prp: prpText,
        combined_interpretation: readText(safety.combined_interpretation),
      },
      job_fit_analysis: jobFit,
      integrated_analysis: [jobFit, readText(safety.combined_interpretation)].filter(Boolean).join("\n\n"),
      preliminary_conclusion: conclusion,
      integrated_conclusion: conclusion,
      limitations,
      material_limitations: limitations,
      evidence: [],
    } satisfies PsychAIOutput;
  }
  const instrumentAnalysis = asRecord(source.instrument_analysis);
  const strengths = asArray(source.strengths).map(asRecord);
  const points = asArray(source.points_to_explore).map(asRecord);
  const questions = asArray(source.interview_questions).map(asRecord);
  const limitations = deduplicateLimitations(source.limitations);
  const fallbackContext = context ?? { evidence_catalog: [] } as unknown as PsychSemanticContext;
  const bisText = readText(instrumentAnalysis.bis11, "BIS-11 requiere revision profesional.");
  const prpText = readText(
    instrumentAnalysis.prp,
    "Resultado pendiente de interpretacion profesional debido a que no existe definicion/baremo documentado suficiente para interpretacion automatica.",
  );
  const ipcText = readText(instrumentAnalysis.ipip_ipc, "IPIP-IPC describe octantes y macroestilos propios; no corresponde a DISC.");
  const ipipText = readText(instrumentAnalysis.ipip16, "IPIP-16 usa niveles descriptivos relativos al rango teorico.");

  return {
    version: readText(source.version, PSYCH_SEMANTIC_VERSION),
    recommendation: normalizeRecommendation(source.recommendation),
    recommendation_confidence: normalizeConfidence(source.recommendation_confidence),
    critical_strengths: textList(source.critical_strengths, 4),
    critical_gaps: textList(source.critical_gaps, 4),
    critical_uncertainties: textList(source.critical_uncertainties, 5),
    decision_rationale: readText(source.decision_rationale, readText(source.preliminary_conclusion)),
    profile_summary: readText(source.profile_summary),
    points_to_explore: points as EvidenceBackedStatement[],
    instrument_analysis: {
      ipip16: ipipText,
      ipip_ipc: ipcText,
      bis11: bisText,
      prp: prpText,
    },
    recommendations: asArray(source.recommendations).map((item) => readText(item)).filter(Boolean),
    executive_summary: readText(source.profile_summary, "Interpretacion preliminar no disponible."),
    response_quality:
      "Adecuada. La calidad se basa en completitud y consistencia calculadas por el ERP; debe revisarse junto con los resultados.",
    strengths: arrayText(strengths as EvidenceBackedStatement[]),
    development_areas: arrayText(points as EvidenceBackedStatement[]),
    interview_questions: questions.map((item) => readText(item.question, readText(item.text))).filter(Boolean),
    ipip16: {
      summary: ipipText,
      clusters: {
        autocontrol_estabilidad:
          "Revisar estabilidad, tension, aprension y cumplimiento usando solo niveles descriptivos del rango teorico.",
        disciplina_estructura:
          "Revisar orden, normas y cautela sin convertir niveles intermedios en deficit.",
        interaccion_laboral:
          "Revisar calidez, sociabilidad, reserva y asertividad en contexto de equipo.",
        analisis_adaptacion:
          "Revisar apertura, imaginacion, aprendizaje y autosuficiencia como descriptores teoricos.",
      },
    },
    ipc: {
      summary: ipcText,
      predominant_profile: fallbackContext.locks?.ipc?.macrostyles?.[0]?.label
        ? `Predominante: ${fallbackContext.locks.ipc.macrostyles[0].label}`
        : "Perfil predominante pendiente de revision profesional.",
      disc_disclaimer:
        "Este modelo interno no corresponde a DISC ni a Everything DiSC; usa octantes IPIP-IPC y macroestilos laborales propios.",
    },
    bis11: {
      summary: bisText,
      impulsivity_interpretation: bisText,
    },
    prp: {
      summary: prpText,
      documentation_status: prpText,
    },
    integrated_analysis: readText(
      source.integrated_analysis,
      "Analisis integrado pendiente de revision profesional.",
    ),
    preliminary_conclusion: readText(
      source.preliminary_conclusion,
      "Conclusion preliminar no decisoria; requiere revision profesional.",
    ),
    limitations,
    evidence: [],
  } satisfies PsychAIOutput;
}

export function validatePsychSemanticOutput(value: unknown, context: PsychSemanticContext): PsychSemanticValidation {
  const output = asRecord(value);
  const flags: string[] = [];
  const knownEvidenceIds = new Set(context.evidence_catalog.map((item) => item.id));
  const isV5 = "executive_profile" in output || "personality_profile" in output || "safety_and_impulse_profile" in output;
  const validOrEmpty = (ids: string[]) => isV5 ? ids.every((id) => knownEvidenceIds.has(id)) : ids.length > 0 && ids.every((id) => knownEvidenceIds.has(id));

  if (!readText(output.profile_summary) && !readText(output.executive_profile)) flags.push("missing_profile_summary");
  if (!isV5 && (!output.instrument_analysis || typeof output.instrument_analysis !== "object")) {
    flags.push("missing_instrument_analysis");
  }

  for (const statement of statementsFromOutput(output)) {
    const ids = readEvidenceIds(statement);
    if (!validOrEmpty(ids)) flags.push("invalid_evidence_ids");
    const currentText = statementText(statement);
    if (containsAny(currentText, RISK_TERMS)) flags.push("risk_language");
    for (const id of ids) {
      const evidence = context.evidence_catalog.find((item) => item.id === id);
      if (!evidence) continue;
      if (
        evidence.maxAllowedIntensity === "INTERMEDIATE_ONLY" &&
        containsAny(currentText, ESCALATION_TERMS)
      ) {
        flags.push(`intensity_escalation_${id}`);
      }
      if (
        evidence.instrument === "BARRATT_BIS11_30" &&
        evidence.classification === "SOBRE_EL_PROMEDIO" &&
        containsAny(currentText, ["alto", "alta", "critico", "crítico", "severo", "requiere intervencion", "requiere intervención"])
      ) {
        flags.push("bis11_classification_escalation");
      }
      if (evidence.instrument === "PRP_EMAIL_FORM_A_30" && containsAny(currentText, ["factor 1 es", "factor 2 es", "factor 3 es", "factor 4 es", "factor 5 es", "factor 6 es"])) flags.push("prp_construct_invention");
    }
  }

  for (const strength of asArray(output.strengths)) {
    const currentText = statementText(strength);
    if (containsAny(currentText, METHODOLOGICAL_STRENGTH_TERMS)) flags.push("methodological_strength");
  }

  for (const question of asArray(output.interview_questions)) {
    const currentText = statementText(question);
    if (containsAny(currentText, ["impulsividad fuerte", "controla su irritabilidad", "irritabilidad", "defecto", "debilidad"])) {
      flags.push("non_neutral_interview_question");
    }
  }

  const allText = JSON.stringify(output);
  if (containsAny(allText, context.prohibited_terms)) flags.push("prohibited_semantic_term");
  if (containsAny(allText, ["por debajo del promedio", "por encima del promedio"]) && !allText.includes("SOBRE_EL_PROMEDIO")) {
    flags.push("undocumented_average_language");
  }
  if (containsAny(allText, ["alta apertura"])) flags.push("ape_high_regression");
  if (containsAny(allText, ["baja adherencia"])) flags.push("norm_low_regression");
  if (containsAny(allText, ["irritabilidad sostenida"])) flags.push("tension_direction_regression");

  const prpText = isV5
    ? readText(asRecord(output.safety_and_impulse_profile).prp)
    : readText(asRecord(output.instrument_analysis).prp);
  if (context.locks.prp && containsAny(prpText, ["percentil", "eneatipo", "baremo chileno", "factor 1 es", "factor 2 es", "factor 3 es", "factor 4 es", "factor 5 es", "factor 6 es"])) {
    flags.push("prp_methodology_overreach");
  }
  const ipcText = `${readText(asRecord(output.instrument_analysis).ipip_ipc)} ${JSON.stringify(output)}`;
  const directivo = context.locks.ipc?.macrostyles.find((item) => normalizeText(item.label) === "directivo");
  if (directivo && directivo.rank > 2 && containsAny(ipcText, ["directivo como segunda", "tendencia secundaria directiva", "directivo segundo"])) {
    flags.push("ipc_directive_second_regression");
  }

  return { ok: flags.length === 0, flags: unique(flags) };
}
