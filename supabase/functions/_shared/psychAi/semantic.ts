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
      interpretation_status: "PROFESSIONAL_ONLY";
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
  CAU: "Cautela interpersonal",
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
      semanticLevel: "PROFESSIONAL_ONLY",
      direction: "UNKNOWN",
      sourceVersion: "prp-professional-only-v1",
      maxAllowedIntensity: "PROFESSIONAL_ONLY",
      interpretationStatus: "PROFESSIONAL_ONLY",
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
        allowed_statement:
          "Resultado pendiente de interpretacion profesional debido a que no existe definicion/baremo documentado suficiente para interpretacion automatica.",
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
    semantic_context,
    constraints: {
      ...asRecord(input.constraints),
      semantic_guardrails_version: PSYCH_SEMANTIC_VERSION,
      llm_must_use_evidence_ids: true,
      llm_must_not_infer_intensity: true,
      prp_professional_only: true,
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
  return [
    ...asArray(output.strengths),
    ...asArray(output.points_to_explore),
    ...asArray(output.interview_questions),
  ].map(asRecord) as EvidenceBackedStatement[];
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
  const nor = context.evidence_catalog.find((item) => item.id === "ev_ipip16_NOR");
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

  const v3 = {
    profile_summary:
      `Informe generado con guardrails semanticos determinísticos porque el ${displayFallbackReason(reason)}. Los resultados se presentan como antecedentes descriptivos y requieren revision profesional.`,
    strengths,
    points_to_explore: points,
    instrument_analysis: {
      ipip16:
        `IPIP-16 se informa con niveles descriptivos relativos al rango teorico 1-5. ${ipipIntermediate.length} dimensiones se ubican en nivel intermedio; no corresponde hablar de promedio poblacional sin baremo documentado.`,
      ipip_ipc: predominant
        ? `IPIP-IPC muestra predominancia ${predominant.label}${second ? ` y segundo macroestilo ${second.label}` : ""}. No corresponde describir Directivo como tendencia secundaria si no ocupa el segundo lugar.`
        : "IPIP-IPC disponible para revision profesional.",
      bis11: bis
        ? `BIS-11: puntaje ${bis.score}, clasificacion ${bis.classification}. No se escala a alto, critico ni severo.`
        : "BIS-11 disponible para revision profesional.",
      prp: prp?.allowed_statement ??
        "PRP pendiente de interpretacion profesional debido a documentacion insuficiente para interpretacion automatica.",
    },
    integrated_analysis:
      "La lectura integrada separa criticidad del cargo de severidad del resultado. Los hallazgos deben contrastarse con entrevista, antecedentes laborales y criterio profesional.",
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
    preliminary_conclusion:
      "Conclusión preliminar no decisoria. Los tests no determinan aptitud por si solos; el resultado debe ser revisado profesionalmente junto con entrevista y antecedentes del proceso.",
    recommendations: [],
    limitations: deduplicateLimitations([
      "No constituye diagnostico clinico.",
      "No constituye decision automatica de contratacion o rechazo.",
      "Los niveles IPIP son descriptivos del rango teorico y no percentiles poblacionales.",
      "PRP permanece pendiente de interpretacion profesional por falta de definicion/baremo suficiente.",
    ]),
  };

  return v3 as unknown as PsychAIOutput;
}

function arrayText(items: EvidenceBackedStatement[]) {
  return items.map((item) => item.text || item.question || item.title || "").filter(Boolean);
}

export function normalizeSemanticOutputForErp(value: unknown, context?: PsychSemanticContext): PsychAIOutput {
  const source = asRecord(value);
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
    evidence: fallbackContext.evidence_catalog.map((item) =>
      `${item.id}: ${item.instrument}${item.dimension ? `/${item.dimension}` : ""} ${item.score ?? item.classification ?? ""} ${item.semanticLevel ?? ""}`.trim()
    ).slice(0, 10),
  } satisfies PsychAIOutput;
}

export function validatePsychSemanticOutput(value: unknown, context: PsychSemanticContext): PsychSemanticValidation {
  const output = asRecord(value);
  const flags: string[] = [];
  const knownEvidenceIds = new Set(context.evidence_catalog.map((item) => item.id));
  const validOrEmpty = (ids: string[]) => ids.length > 0 && ids.every((id) => knownEvidenceIds.has(id));

  if (!readText(output.profile_summary)) flags.push("missing_profile_summary");
  if (!output.instrument_analysis || typeof output.instrument_analysis !== "object") {
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
      if (
        evidence.instrument === "PRP_EMAIL_FORM_A_30" &&
        containsAny(currentText, ["organizacion", "organización", "responsabilidad", "control", "documentacion y organizacion", "documentación y organización"])
      ) {
        flags.push("prp_construct_invention");
      }
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

  const prpText = readText(asRecord(output.instrument_analysis).prp);
  if (context.locks.prp && !containsAny(prpText, ["pendiente de interpretacion profesional", "pendiente de interpretación profesional"])) {
    flags.push("prp_hard_lock_missing");
  }
  const ipcText = `${readText(asRecord(output.instrument_analysis).ipip_ipc)} ${JSON.stringify(output)}`;
  const directivo = context.locks.ipc?.macrostyles.find((item) => normalizeText(item.label) === "directivo");
  if (directivo && directivo.rank > 2 && containsAny(ipcText, ["directivo como segunda", "tendencia secundaria directiva", "directivo segundo"])) {
    flags.push("ipc_directive_second_regression");
  }

  return { ok: flags.length === 0, flags: unique(flags) };
}
