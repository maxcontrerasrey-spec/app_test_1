import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import { createClient } from "npm:@supabase/supabase-js@2.108.1";
import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "npm:pdf-lib@1.17.1";
import { getSupabaseSecretKey } from "../_shared/supabaseKeys.ts";
import {
  CONSORCIO_ANDINO_LOGO_BASE64,
  CONSORCIO_NUEVO_NORTE_LOGO_BASE64,
  CERTIFICATE_SIGNATURE_FONT_BASE64,
  JM_LOGO_BASE64,
} from "../generate-competency-certificate/logos.ts";

const BUCKET = "psychometric_documents";
const CANDIDATE_DOCUMENTS_BUCKET = "candidate-docs";
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gestion.busesjm.cl",
  "Content-Type": "application/json",
};

function publicErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "No fue posible generar el certificado";
  return message.slice(0, 600);
}

type Payload = {
  assessment_id: string;
  public_id: string;
  completed_at: string;
  candidate: {
    full_name: string;
    national_id: string;
    job_position_name: string;
    contract_name: string;
    case_code: string;
    company_name: string;
  };
  ai_interpretation?: {
    id: string;
    status: string;
    provider: string;
    model: string;
    display_output?: PsychAIOutput | null;
    validation_flags?: string[];
    guardrail_flags?: string[];
    reviewer_comment?: string | null;
    reviewed_at?: string | null;
    generated_at?: string | null;
  } | null;
  psychologist_review: {
    reviewer_name: string;
    reviewer_document_number: string;
    reviewer_role: string;
    reviewer_comment: string;
    reviewed_at: string;
    signature_hash: string;
  };
  instruments: Array<{
    code: string;
    name: string;
    result: Record<string, unknown>;
    response_count: number;
    response_summary: Array<{ label: string; count: number }>;
    quality?: {
      status?: string;
      completitud?: number;
      items_respondidos?: number;
      valores_distintos?: number;
      neutros_indecisos?: number;
      extremos?: number;
      straight_lining?: boolean;
      motivos?: string[];
    };
    result_sha256: string;
  }>;
  consents: Array<
    {
      code: string;
      version: string;
      document_sha256: string;
      accepted_at: string;
    }
  >;
};

type PsychAIOutput = {
  recommendation?: string;
  recommendation_confidence?: string;
  critical_strengths?: string[];
  critical_gaps?: string[];
  critical_uncertainties?: string[];
  decision_rationale?: string;
  executive_profile?: string;
  executive_summary?: string;
  response_quality?: string;
  strengths?: string[];
  development_areas?: string[];
  interview_questions?: string[];
  ipip16?: { summary?: string; clusters?: Record<string, string> };
  ipc?: { summary?: string; predominant_profile?: string; disc_disclaimer?: string };
  bis11?: { summary?: string; impulsivity_interpretation?: string };
  prp?: { summary?: string; documentation_status?: string };
  personality_profile?: {
    summary?: string;
    self_regulation?: string;
    discipline_structure?: string;
    interpersonal_style?: string;
    adaptability_thinking?: string;
  };
  interpersonal_profile?: {
    summary?: string;
    communication?: string;
    cooperation?: string;
    initiative?: string;
    response_under_pressure?: string;
  };
  safety_and_impulse_profile?: {
    summary?: string;
    bis11?: string;
    prp?: string;
    combined_interpretation?: string;
  };
  job_fit_analysis?: string;
  adjustment_to_role?: string;
  competency_matrix?: Array<{
    competency?: string;
    evidence_level?: string;
    level?: string;
    interpretation?: string;
  }>;
  evidence_integration?: {
    summary?: string;
    convergences?: string[];
    divergences?: string[];
  };
  prp_assessment?: {
    classification?: string;
    meaning?: string;
    status?: string;
  };
  integrated_conclusion?: string;
  material_limitations?: string[];
  integrated_analysis?: string;
  preliminary_conclusion?: string;
  limitations?: string[];
  evidence?: string[];
};

function bytesFromBase64(value: string) {
  const data = value.includes(",") ? value.split(",").at(-1) ?? "" : value;
  return Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
}

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safePdfText(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function namedScores(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return Object.values(value as Record<string, unknown>)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";
      const score = item as Record<string, unknown>;
      return `${String(score.name ?? "Dimensión")}: ${String(score.mean ?? score.score ?? "-")}`;
    })
    .filter(Boolean)
    .join(" · ");
}

function formatResult(result: Record<string, unknown>) {
  if (result.kind === "barratt") {
    return `Puntaje total: ${result.total}. Clasificación: ${result.classification}.`;
  }
  if (result.kind === "ipc32") {
    return `Ejes continuos - Calidez: ${result.warmth}; Dominancia: ${result.dominance}. Octantes IPIP-IPC: ${namedScores(result.octants)}`;
  }
  if (result.kind === "ipip16") {
    return `Dimensiones (media 1-5): ${namedScores(result.dimensions)}.`;
  }
  if (result.kind === "prp") {
    return `Puntaje directo: ${result.raw_total}.`;
  }
  return "Resultados disponibles en el ERP.";
}

function normalizeCompanyName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function resolveLogo(companyName: string) {
  const normalized = normalizeCompanyName(companyName);
  if (normalized.includes("consorcio andino")) return CONSORCIO_ANDINO_LOGO_BASE64;
  if (normalized.includes("consorcio nuevo norte")) return CONSORCIO_NUEVO_NORTE_LOGO_BASE64;
  return JM_LOGO_BASE64;
}

function responseSummary(items: Array<{ label: string; count: number }>) {
  return items.map((item) => `${item.label}: ${item.count}`).join(" · ");
}

function safePdfText(value: string) {
  return value
    .normalize("NFC")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\u00a0/g, " ");
}

function humanizeCode(value: unknown, fallback = "") {
  const source = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return source
    .replace(/_/g, " ")
    .toLocaleLowerCase("es-CL")
    .replace(/(^|\s)\S/g, (match) => match.toLocaleUpperCase("es-CL"));
}

function sanitizeReportText(value: string) {
  return value
    .replace(/\bPsicologa\b/g, "Psicóloga")
    .replace(/\bpsicologa\b/g, "psicóloga")
    .replace(/\bPsicologo\b/g, "Psicólogo")
    .replace(/\bpsicologo\b/g, "psicólogo")
    .replace(/\bLa interpretaci[oó]n es descriptiva[^.]*baremos[^.]*conducta observada\.?/gi, "")
    .replace(/\bLa interpretaci[oó]n queda pendiente de revisi[oó]n profesional\.?/gi, "")
    .replace(/\bEl resultado no puede interpretarse autom[aá]ticamente\.?/gi, "")
    .replace(/\bRecomendaci[oó]n preliminar automatizad[ao]\b/gi, "Resultado de evaluación")
    .replace(/\bConfianza\s+automatizad[ao]:?\s*[A-ZÁÉÍÓÚÑ_ ]*\.?/gi, "")
    .replace(/\bEsta recomendaci[oó]n es preliminar[^.]*validaci[oó]n humana[^.]*\.?/gi, "")
    .replace(/\bValidaci[oó]n profesional requerida\b/gi, "")
    .replace(/\brevisi[oó]n profesional separada\b/gi, "revisión del proceso")
    .replace(/\bvalidaci[oó]n humana\b/gi, "evaluación del proceso")
    .replace(/\binterpretaci[oó]n automatizada\b/gi, "interpretación integrada")
    .replace(/\bautomatizad[oa]\b/gi, "estructurado")
    .replace(/\binteligencia artificial\b/gi, "integración de resultados")
    .replace(/\bOpenAI\b/g, "sistema")
    .replace(/\bGPT\b/g, "sistema")
    .replace(/\bLuna\b/g, "sistema")
    .replace(/\bproveedor\b/gi, "servicio")
    .replace(/\bmodelo\b/gi, "criterio")
    .replace(/\bfallback\b/gi, "contingencia")
    .replace(/\bguardrail(?:s)?\b/gi, "criterios metodológicos")
    .replace(/\bschema\b/gi, "estructura")
    .replace(/\bprompt\b/gi, "instrucción")
    .replace(/\bInforme V5(?:\.[0-9])?\b/gi, "Informe")
    .replace(/\bV5(?:\.[0-9])?\b/g, "")
    .replace(/\bpendiente de revisi[oó]n profesional\b/gi, "en evaluación")
    .replace(/\bREQUIERE_PROFUNDIZACION\b/g, "profundización sugerida")
    .replace(/\bADECUADO_CON_OBSERVACIONES\b/g, "adecuado con observaciones")
    .replace(/\bNO_ADECUADO\b/g, "no adecuado")
    .replace(/\bOUT_OF_DOCUMENTED_RANGE\b/g, "fuera de rango documentado")
    .replace(/\bSOBRE_EL_PROMEDIO\b/g, "sobre el promedio")
    .replace(/\bINTERMEDIO_EN_RANGO_TEORICO\b/g, "intermedio dentro del rango teórico")
    .replace(/\bdebe corroborarse\b/gi, "se recomienda profundizar")
    .replace(/\brequiere corroboraci[oó]n\b/gi, "requiere profundización")
    .replace(/\bdebe verificarse\b/gi, "se recomienda contrastar")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function text(value: unknown, fallback = "") {
  const candidate = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return safePdfText(sanitizeReportText(candidate));
}

function professionalRole(value: unknown, fallback = "Psicólogo/a responsable") {
  return text(value, fallback)
    .replace(/\bPsicologa\b/g, "Psicóloga")
    .replace(/\bpsicologa\b/g, "psicóloga")
    .replace(/\bPsicologo\b/g, "Psicólogo")
    .replace(/\bpsicologo\b/g, "psicólogo");
}

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => text(item)).filter(Boolean)
    : [];
}

function drawCenteredText(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size: number,
  color = rgb(0.07, 0.08, 0.1),
) {
  const safeValue = safePdfText(value);
  const textWidth = font.widthOfTextAtSize(safeValue, size);
  page.drawText(safeValue, {
    x: x + Math.max(0, (width - textWidth) / 2),
    y,
    size,
    font,
    color,
  });
}

function clusterLabel(value: string) {
  const labels: Record<string, string> = {
    autocontrol_estabilidad: "Autocontrol y Estabilidad",
    disciplina_estructura: "Disciplina y Estructura",
    interaccion_laboral: "Interacción Laboral",
    analisis_adaptacion: "Análisis y Adaptación",
    self_regulation: "Autorregulación y estabilidad",
    discipline_structure: "Disciplina y estructura",
    interpersonal_style: "Interacción laboral",
    adaptability_thinking: "Adaptabilidad y pensamiento",
  };
  return labels[value] ?? value;
}

function evidenceLevelLabel(value: string) {
  const normalized = value.toUpperCase();
  if (normalized === "DIRECT_EVIDENCE") return "Evidencia directa";
  if (normalized === "INTEGRATED_EVIDENCE") return "Evidencia integrada";
  if (normalized === "INSUFFICIENT_EVIDENCE") return "Sin evidencia suficiente";
  return value;
}

function defaultAIOutput(payload: Payload): PsychAIOutput {
  const evidence = payload.instruments.map((instrument) =>
    `${instrument.code}: ${instrument.response_count} respuestas, hash ${instrument.result_sha256.slice(0, 12)}`,
  );
  return {
    executive_summary:
      "Informe de contingencia generado con resultados calculados por el ERP. No se emite una integración interpretativa completa para esta evaluación.",
    response_quality: payload.instruments.map((instrument) =>
      `${instrument.name}: ${instrument.quality?.status ?? "REVISAR"}`
    ).join("; "),
    strengths: [
      "Batería completada y puntuada con reglas versionadas.",
      "Resultados disponibles para contraste con entrevista.",
      "Trazabilidad de scoring, calidad y consentimientos preservada.",
    ],
    development_areas: [
      "Profundizar patrones extremos o de baja variabilidad.",
      "Contrastar resultados con ejemplos laborales concretos.",
      "Profundizar PRP solo si existen antecedentes documentales suficientes.",
    ],
    interview_questions: [
      "Describa una situación reciente de presión laboral y cómo la resolvió.",
      "¿Cómo actúa cuando una instrucción operacional entra en conflicto con la seguridad?",
      "¿Qué señales le indican que debe pedir apoyo antes de continuar una tarea?",
      "Cuéntenos de una ocasión en que recibió retroalimentación difícil.",
    ],
    ipip16: {
      summary: "Perfil IPIP-16 calculado por el ERP en 16 dimensiones continuas.",
      clusters: {
        autocontrol_estabilidad: "Revisar estabilidad, tensión, aprensión y cumplimiento como patrón conjunto.",
        disciplina_estructura: "Revisar orden, normas y cautela frente a exigencias operativas.",
        interaccion_laboral: "Revisar calidez, sociabilidad, reserva y asertividad en contexto de equipo.",
        analisis_adaptacion: "Revisar apertura, imaginación, aprendizaje y autosuficiencia.",
      },
    },
    ipc: {
      summary: "IPIP-IPC describe octantes interpersonales y ejes de calidez/dominancia.",
      predominant_profile: "Perfil predominante integrado en el análisis interpersonal.",
      disc_disclaimer:
        "IPIP-IPC usa octantes y macroestilos laborales propios; no corresponde a DISC ni a Everything DiSC.",
    },
    bis11: {
      summary: "BIS-11 informa impulsividad como antecedente descriptivo.",
      impulsivity_interpretation:
        "Interpretar junto con entrevista, historial operacional y contexto del cargo.",
    },
    prp: {
      summary: "PRP conserva puntaje directo y factores documentados.",
      documentation_status:
        "Se informa solo la salida documentada disponible.",
    },
    integrated_analysis:
      "El análisis integrado combina resultados calculados, calidad de respuesta, perfil del cargo y entrevista.",
    preliminary_conclusion:
      "Conclusión no emitida por falta de antecedentes interpretativos suficientes.",
    limitations: [
      "No constituye diagnóstico clínico.",
    ],
    evidence,
  };
}

function drawWrappedLines(
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  maxLines = 8,
  color = rgb(0.12, 0.14, 0.18),
) {
  let cursor = y;
  let count = 0;
  for (const line of lines.flatMap((item) => wrap(item, font, size, maxWidth))) {
    if (count >= maxLines) break;
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= size + 4;
    count += 1;
  }
  return cursor;
}

function drawBulletList(
  page: PDFPage,
  items: string[],
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  maxItems = 6,
) {
  let cursor = y;
  for (const item of items.slice(0, maxItems)) {
    page.drawText("-", { x, y: cursor, size, font, color: rgb(0.72, 0.06, 0.08) });
    cursor = drawWrappedLines(page, [item], font, size, x + 12, cursor, maxWidth - 12, 2);
    cursor -= 2;
  }
  return cursor;
}

function drawPanel(
  page: PDFPage,
  title: string,
  font: PDFFont,
  bold: PDFFont,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: 0.7,
    borderColor: rgb(0.86, 0.88, 0.91),
    color: rgb(0.985, 0.988, 0.992),
  });
  page.drawText(safePdfText(title), { x: x + 12, y: y + height - 20, size: 10, font: bold, color: rgb(0.08, 0.1, 0.14) });
}

function dimensionEntries(result: Record<string, unknown>) {
  const dimensions = result.dimensions as Record<string, { name?: string; mean?: number }> | undefined;
  if (!dimensions) return [];
  return Object.entries(dimensions).map(([code, item]) => ({
    code,
    name: item.name ?? code,
    mean: Number(item.mean ?? 0),
  }));
}

function octantEntries(result: Record<string, unknown>) {
  const octants = result.octants as Record<string, { name?: string; mean?: number }> | undefined;
  if (!octants) return [];
  return Object.entries(octants).map(([code, item]) => ({
    code,
    name: item.name ?? code,
    mean: Number(item.mean ?? 0),
  }));
}

function drawBarChart(
  page: PDFPage,
  entries: Array<{ name: string; mean: number }>,
  font: PDFFont,
  bold: PDFFont,
  x: number,
  y: number,
  width: number,
) {
  let cursor = y;
  for (const entry of entries.slice(0, 16)) {
    const label = text(entry.name);
    const labelSize = font.widthOfTextAtSize(label, 7) > 145 ? 6.2 : 7;
    page.drawText(label, { x, y: cursor, size: labelSize, font });
    const barX = x + 155;
    page.drawRectangle({ x: barX, y: cursor - 1, width: width - 195, height: 7, color: rgb(0.9, 0.92, 0.95) });
    page.drawRectangle({
      x: barX,
      y: cursor - 1,
      width: Math.max(0, Math.min(width - 195, ((entry.mean || 0) / 5) * (width - 195))),
      height: 7,
      color: rgb(0.73, 0.06, 0.08),
    });
    page.drawText(entry.mean.toFixed(2), { x: x + width - 35, y: cursor - 1, size: 7, font: bold });
    cursor -= 14;
  }
  return cursor;
}

function drawRadar(
  page: PDFPage,
  entries: Array<{ code: string; mean: number }>,
  font: PDFFont,
  centerX: number,
  centerY: number,
  radius: number,
) {
  const count = Math.max(entries.length, 1);
  for (const scale of [0.25, 0.5, 0.75, 1]) {
    const points = entries.map((_, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
      return { x: centerX + Math.cos(angle) * radius * scale, y: centerY + Math.sin(angle) * radius * scale };
    });
    for (let index = 0; index < points.length; index += 1) {
      page.drawLine({
        start: points[index],
        end: points[(index + 1) % points.length],
        thickness: 0.35,
        color: rgb(0.82, 0.85, 0.89),
      });
    }
  }
  const valuePoints = entries.map((entry, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    const valueRadius = radius * Math.max(0, Math.min(1, entry.mean / 5));
    const labelRadius = radius + 18;
    page.drawText(text(entry.code), {
      x: centerX + Math.cos(angle) * labelRadius - 8,
      y: centerY + Math.sin(angle) * labelRadius - 3,
      size: 7,
      font,
      color: rgb(0.25, 0.29, 0.36),
    });
    return { x: centerX + Math.cos(angle) * valueRadius, y: centerY + Math.sin(angle) * valueRadius };
  });
  for (let index = 0; index < valuePoints.length; index += 1) {
    page.drawLine({
      start: valuePoints[index],
      end: valuePoints[(index + 1) % valuePoints.length],
      thickness: 1.4,
      color: rgb(0.72, 0.06, 0.08),
    });
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value)).replace(",", "");
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "2-digit",
  }).format(new Date(value)).replace(/\//g, "-");
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago", day: "2-digit", month: "long", year: "numeric",
  }).format(new Date(value));
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  logo: PDFImage,
  folio: string,
  pageNumber = 1,
  totalPages = 1,
  titleLines = ["Certificado de Evaluación", "Psicolaboral"],
  metadata?: { code: string; date: string; version: string },
) {
  const { width, height } = page.getSize();
  const accent = rgb(0.82, 0.03, 0.07);
  const muted = rgb(0.48, 0.52, 0.58);
  const header = { x: 32, y: height - 121, width: width - 64, height: 101 };
  const logoCell = { x: header.x, y: header.y, width: 121, height: header.height };
  const metadataCell = { x: width - 158, y: header.y, width: 126, height: header.height };
  const titleCell = {
    x: logoCell.x + logoCell.width,
    y: header.y,
    width: metadataCell.x - (logoCell.x + logoCell.width),
    height: header.height,
  };
  const logoMaxWidth = 68;
  const logoMaxHeight = 68;
  const logoScale = Math.min(logoMaxWidth / logo.width, logoMaxHeight / logo.height);
  const logoWidth = logo.width * logoScale;
  const logoHeight = logo.height * logoScale;

  page.drawImage(logo, {
    x: logoCell.x + (logoCell.width - logoWidth) / 2,
    y: logoCell.y + (logoCell.height - logoHeight) / 2,
    width: logoWidth,
    height: logoHeight,
  });
  if (titleLines.length === 1) {
    drawCenteredText(page, titleLines[0], titleCell.x, height - 86, titleCell.width, bold, 18);
  } else {
    drawCenteredText(page, titleLines[0] ?? "", titleCell.x, height - 76, titleCell.width, bold, 19);
    drawCenteredText(page, titleLines[1] ?? "", titleCell.x, height - 101, titleCell.width, bold, 19);
  }
  drawPageMetadata(page, font, pageNumber, totalPages, metadata, folio, metadataCell.x, height, muted);
  page.drawLine({
    start: { x: header.x, y: header.y },
    end: { x: header.x + header.width, y: header.y },
    thickness: 2,
    color: accent,
  });
}

function drawPageMetadata(
  page: PDFPage,
  font: PDFFont,
  pageNumber: number,
  totalPages: number,
  metadata: { code: string; date: string; version: string } | undefined,
  folio: string,
  metadataX: number,
  pageHeight: number,
  muted = rgb(0.48, 0.52, 0.58),
) {
  // Headers are created incrementally, but the final page count is known only
  // after all content has been laid out. Replace this small metadata cell in a
  // second pass so every page displays the same final denominator.
  page.drawRectangle({
    x: metadataX,
    y: pageHeight - 120,
    width: 150,
    height: 82,
    color: rgb(1, 1, 1),
  });
  const metadataLines = metadata
    ? [`Código: ${metadata.code}`, `Fecha: ${metadata.date}`, `Versión: ${metadata.version}`, `Página: ${pageNumber} de ${totalPages}`]
    : [`Folio: PS-${folio.slice(0, 8).toUpperCase()}`, `Página: ${pageNumber} de ${totalPages}`];
  metadataLines.forEach((line, index) => page.drawText(line, {
    x: metadataX + 8,
    y: pageHeight - 55 - index * 14,
    size: 8,
    font,
    color: muted,
  }));
}

const REPORT = {
  marginX: 45,
  topY: 635,
  bottomY: 58,
  width: 522,
  sectionGap: 11,
  titleGap: 7,
  paragraphGap: 4,
  cardPaddingX: 14,
  cardPaddingY: 10,
  bodySize: 8.7,
  bodyLineHeight: 13.2,
  smallSize: 7.7,
  smallLineHeight: 11.4,
  h1: 18,
  h2: 13,
  h3: 10,
};

const REPORT_TITLE_LINES = ["Informe de Evaluación", "Psicolaboral"];
const REPORT_METADATA = { code: "F-RH-009", date: "17-08-26", version: "1" };

type ReportContext = {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  signature: PDFFont;
  logo: PDFImage;
  payload: Payload;
  page: PDFPage;
  y: number;
};

function cleanList(items: unknown, max = 8) {
  return list(items).slice(0, max);
}

function linesForParagraph(value: string, font: PDFFont, size: number, width: number) {
  return wrap(text(value), font, size, width);
}

function drawJustifiedParagraph(
  page: PDFPage,
  value: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color = rgb(0.16, 0.18, 0.22),
) {
  const lines = linesForParagraph(value, font, size, maxWidth);
  let cursor = y;
  lines.forEach((line, index) => {
    const words = line.split(/\s+/).filter(Boolean);
    const isLast = index === lines.length - 1 || words.length < 3;
    if (isLast) {
      page.drawText(line, { x, y: cursor, size, font, color });
    } else {
      const wordsWidth = words.reduce((sum, word) => sum + font.widthOfTextAtSize(word, size), 0);
      const gap = Math.max(2.2, (maxWidth - wordsWidth) / (words.length - 1));
      let wordX = x;
      for (const word of words) {
        page.drawText(word, { x: wordX, y: cursor, size, font, color });
        wordX += font.widthOfTextAtSize(word, size) + gap;
      }
    }
    cursor -= lineHeight;
  });
  return { y: cursor, lines: lines.length };
}

function paragraphHeight(value: string, font: PDFFont, size: number, width: number, lineHeight: number) {
  return Math.max(1, linesForParagraph(value, font, size, width).length) * lineHeight;
}

function bulletHeight(items: string[], font: PDFFont, size: number, width: number, lineHeight: number) {
  return items.reduce((sum, item) => sum + paragraphHeight(item, font, size, width - 16, lineHeight) + 4, 0);
}

function startReportPage(ctx: ReportContext, pageNumber: number) {
  ctx.page = ctx.doc.addPage([612, 792]);
  drawHeader(ctx.page, ctx.font, ctx.bold, ctx.logo, ctx.payload.public_id, pageNumber, 1, REPORT_TITLE_LINES, REPORT_METADATA);
  ctx.y = REPORT.topY;
}

function ensureSpace(ctx: ReportContext, height: number, minCarry = 36) {
  if (ctx.y - height >= REPORT.bottomY + minCarry) return;
  startReportPage(ctx, ctx.doc.getPageCount() + 1);
}

function drawReportFooter(ctx: ReportContext, totalPages: number) {
  ctx.doc.getPages().forEach((target, index) => {
    drawPageMetadata(
      target,
      ctx.font,
      index + 1,
      totalPages,
      REPORT_METADATA,
      ctx.payload.public_id,
      target.getWidth() - 158,
      target.getHeight(),
    );
    target.drawText(`Documento confidencial - PS-${ctx.payload.public_id.slice(0, 8).toUpperCase()} - Página ${index + 1} de ${totalPages}`, {
      x: REPORT.marginX,
      y: 28,
      size: 7,
      font: ctx.font,
      color: rgb(0.35, 0.38, 0.42),
    });
  });
}

function drawReportHeading(ctx: ReportContext, title: string, subtitle?: string) {
  ensureSpace(ctx, subtitle ? 54 : 36);
  ctx.page.drawText(text(title), { x: REPORT.marginX, y: ctx.y, size: REPORT.h1, font: ctx.bold, color: rgb(0.07, 0.08, 0.1) });
  ctx.y -= 23;
  if (subtitle) {
    ctx.page.drawText(text(subtitle), { x: REPORT.marginX, y: ctx.y, size: 10.5, font: ctx.font, color: rgb(0.38, 0.42, 0.5) });
    ctx.y -= 24;
  } else {
    ctx.y -= 14;
  }
}

function drawCard(ctx: ReportContext, title: string, paragraphs: string[], options: { tone?: "default" | "result"; minHeight?: number } = {}) {
  const bodyWidth = REPORT.width - REPORT.cardPaddingX * 2;
  const cleanParagraphs = paragraphs.map((item) => text(item)).filter(Boolean);
  const contentHeight = cleanParagraphs.reduce(
    (sum, item) => sum + paragraphHeight(item, ctx.font, REPORT.bodySize, bodyWidth, REPORT.bodyLineHeight) + REPORT.paragraphGap,
    0,
  );
  const height = Math.max(
    options.minHeight ?? 0,
    REPORT.cardPaddingY * 2 + 16 + REPORT.titleGap + Math.max(0, contentHeight - REPORT.paragraphGap),
  );
  ensureSpace(ctx, height + REPORT.sectionGap);
  const yBottom = ctx.y - height;
  ctx.page.drawRectangle({
    x: REPORT.marginX,
    y: yBottom,
    width: REPORT.width,
    height,
    borderWidth: 0.7,
    borderColor: options.tone === "result" ? rgb(0.78, 0.14, 0.18) : rgb(0.86, 0.88, 0.91),
    color: options.tone === "result" ? rgb(0.995, 0.968, 0.97) : rgb(0.992, 0.994, 0.997),
  });
  ctx.page.drawText(text(title), {
    x: REPORT.marginX + REPORT.cardPaddingX,
    y: ctx.y - REPORT.cardPaddingY - 6,
    size: REPORT.h3,
    font: ctx.bold,
    color: options.tone === "result" ? rgb(0.55, 0.04, 0.07) : rgb(0.08, 0.1, 0.14),
  });
  let cursor = ctx.y - REPORT.cardPaddingY - 6 - 18;
  for (const paragraph of cleanParagraphs) {
    const drawn = drawJustifiedParagraph(ctx.page, paragraph, ctx.font, REPORT.bodySize, REPORT.marginX + REPORT.cardPaddingX, cursor, bodyWidth, REPORT.bodyLineHeight);
    cursor = drawn.y - REPORT.paragraphGap;
  }
  ctx.y = yBottom - REPORT.sectionGap;
}

function drawBulletCard(ctx: ReportContext, title: string, items: string[], options: { width?: number; x?: number; height?: number; tone?: "default" | "result" } = {}) {
  const x = options.x ?? REPORT.marginX;
  const width = options.width ?? REPORT.width;
  const cleanItems = items.map((item) => text(item)).filter(Boolean);
  const bodyWidth = width - REPORT.cardPaddingX * 2;
  const naturalHeight = REPORT.cardPaddingY * 2 + 16 + REPORT.titleGap + Math.max(18, bulletHeight(cleanItems, ctx.font, REPORT.bodySize, bodyWidth, REPORT.bodyLineHeight));
  const height = Math.max(naturalHeight, options.height ?? 0);
  ctx.page.drawRectangle({
    x,
    y: ctx.y - height,
    width,
    height,
    borderWidth: 0.7,
    borderColor: rgb(0.86, 0.88, 0.91),
    color: options.tone === "result" ? rgb(0.995, 0.968, 0.97) : rgb(0.992, 0.994, 0.997),
  });
  ctx.page.drawText(text(title), { x: x + REPORT.cardPaddingX, y: ctx.y - REPORT.cardPaddingY - 6, size: REPORT.h3, font: ctx.bold, color: rgb(0.08, 0.1, 0.14) });
  let cursor = ctx.y - REPORT.cardPaddingY - 25;
  for (const item of cleanItems) {
    ctx.page.drawText("•", { x: x + REPORT.cardPaddingX, y: cursor, size: REPORT.bodySize, font: ctx.bold, color: rgb(0.72, 0.06, 0.08) });
    const drawn = drawJustifiedParagraph(ctx.page, item, ctx.font, REPORT.bodySize, x + REPORT.cardPaddingX + 14, cursor, bodyWidth - 14, REPORT.bodyLineHeight);
    cursor = drawn.y - 4;
  }
  return height;
}

function drawBulletSection(ctx: ReportContext, title: string, items: string[], options: { tone?: "default" | "result" } = {}) {
  const cleanItems = cleanList(items, 8);
  const bodyWidth = REPORT.width - REPORT.cardPaddingX * 2;
  const height = REPORT.cardPaddingY * 2 + 16 + REPORT.titleGap +
    Math.max(18, bulletHeight(cleanItems, ctx.font, REPORT.bodySize, bodyWidth, REPORT.bodyLineHeight));
  ensureSpace(ctx, height + REPORT.sectionGap);
  drawBulletCard(ctx, title, cleanItems, options);
  ctx.y -= height + REPORT.sectionGap;
}

function drawSectionTitle(ctx: ReportContext, title: string) {
  ensureSpace(ctx, 28);
  ctx.page.drawText(text(title), { x: REPORT.marginX, y: ctx.y, size: REPORT.h2, font: ctx.bold, color: rgb(0.07, 0.08, 0.1) });
  ctx.y -= 22;
}

function drawPsychologistValidation(ctx: ReportContext) {
  const review = ctx.payload.psychologist_review;
  const commentLines = wrap(review.reviewer_comment, ctx.font, REPORT.bodySize, REPORT.width - 28);
  // The signature block is part of the panel height. Keeping it in the
  // calculation prevents the hash and RUN from falling outside the border.
  const signatureBlockHeight = 132;
  const commentHeaderHeight = 50;
  const height = commentHeaderHeight + commentLines.length * REPORT.bodyLineHeight + signatureBlockHeight;
  ensureSpace(ctx, height + REPORT.sectionGap, 18);
  const bottom = ctx.y - height;
  ctx.page.drawRectangle({
    x: REPORT.marginX, y: bottom, width: REPORT.width, height,
    borderWidth: 0.8, borderColor: rgb(0.82, 0.08, 0.12), color: rgb(0.998, 0.985, 0.985),
  });
  ctx.page.drawText("Comentarios y validación de Psicólogo", { x: REPORT.marginX + 14, y: ctx.y - 20, size: REPORT.h2, font: ctx.bold, color: rgb(0.42, 0.03, 0.06) });
  let cursor = ctx.y - 42;
  for (const line of commentLines) {
    ctx.page.drawText(line, { x: REPORT.marginX + 14, y: cursor, size: REPORT.bodySize, font: ctx.font, color: rgb(0.16, 0.18, 0.22) });
    cursor -= REPORT.bodyLineHeight;
  }
  cursor -= 8;
  ctx.page.drawLine({ start: { x: REPORT.marginX + 14, y: cursor }, end: { x: REPORT.marginX + 240, y: cursor }, thickness: 0.7, color: rgb(0.73, 0.76, 0.81) });
  ctx.page.drawText("VALIDACIÓN DEL INFORME", { x: REPORT.marginX + 14, y: cursor - 18, size: 10, font: ctx.bold, color: rgb(0.08, 0.1, 0.18) });
  ctx.page.drawText(`Firmado electrónicamente el ${formatLongDate(review.reviewed_at)}, por:`, { x: REPORT.marginX + 14, y: cursor - 36, size: 8.5, font: ctx.font, color: rgb(0.12, 0.14, 0.2) });
  ctx.page.drawText(text(review.reviewer_name), { x: REPORT.marginX + 14, y: cursor - 64, size: 17, font: ctx.signature, color: rgb(0.06, 0.07, 0.1) });
  ctx.page.drawLine({ start: { x: REPORT.marginX + 14, y: cursor - 70 }, end: { x: REPORT.marginX + 240, y: cursor - 70 }, thickness: 0.7, color: rgb(0.73, 0.76, 0.81) });
  ctx.page.drawText(professionalRole(review.reviewer_role), { x: REPORT.marginX + 14, y: cursor - 87, size: 8.5, font: ctx.font, color: rgb(0.08, 0.1, 0.18) });
  ctx.page.drawText(`RUN N. ${text(review.reviewer_document_number)}`, { x: REPORT.marginX + 14, y: cursor - 103, size: 8.5, font: ctx.font, color: rgb(0.08, 0.1, 0.18) });
  ctx.page.drawText(`Firmado digitalmente con hash: ${review.signature_hash.slice(0, 24)}...`, { x: REPORT.marginX + 14, y: cursor - 119, size: 7.2, font: ctx.font, color: rgb(0.35, 0.38, 0.45) });
  ctx.y = bottom - REPORT.sectionGap;
}

function drawTwoColumnBulletCards(ctx: ReportContext, leftTitle: string, left: string[], rightTitle: string, right: string[]) {
  const gap = 16;
  const width = (REPORT.width - gap) / 2;
  const leftHeight = REPORT.cardPaddingY * 2 + 16 + REPORT.titleGap + Math.max(22, bulletHeight(left, ctx.font, REPORT.bodySize, width - REPORT.cardPaddingX * 2, REPORT.bodyLineHeight));
  const rightHeight = REPORT.cardPaddingY * 2 + 16 + REPORT.titleGap + Math.max(22, bulletHeight(right, ctx.font, REPORT.bodySize, width - REPORT.cardPaddingX * 2, REPORT.bodyLineHeight));
  const sharedHeight = Math.max(leftHeight, rightHeight);
  const followingSectionGap = Math.max(REPORT.sectionGap, 20);
  const required = sharedHeight + followingSectionGap;
  if (required > 245 || left.length > 4 || right.length > 4) {
    drawBulletSection(ctx, leftTitle, left);
    drawBulletSection(ctx, rightTitle, right);
    return;
  }
  ensureSpace(ctx, required);
  const top = ctx.y;
  drawBulletCard(ctx, leftTitle, left, { width, height: sharedHeight, x: REPORT.marginX });
  ctx.y = top;
  drawBulletCard(ctx, rightTitle, right, { width, height: sharedHeight, x: REPORT.marginX + width + gap });
  ctx.y = top - sharedHeight - followingSectionGap;
}

function drawInstrumentBars(ctx: ReportContext, title: string, entries: Array<{ name: string; mean: number }>) {
  drawSectionTitle(ctx, title);
  const height = Math.min(entries.length, 16) * 13.5 + 22;
  ensureSpace(ctx, height + REPORT.sectionGap);
  ctx.y = drawBarChart(ctx.page, entries, ctx.font, ctx.bold, REPORT.marginX + 6, ctx.y, REPORT.width - 12) - 10;
}

function drawReportPdf(
  report: PDFDocument,
  reportFont: PDFFont,
  reportBold: PDFFont,
  reportLogo: PDFImage,
  signature: PDFFont,
  payload: Payload,
  ai: PsychAIOutput,
) {
  const first = report.addPage([612, 792]);
  const ctx: ReportContext = { doc: report, font: reportFont, bold: reportBold, signature, logo: reportLogo, payload, page: first, y: REPORT.topY };
  drawHeader(ctx.page, ctx.font, ctx.bold, ctx.logo, payload.public_id, 1, 1, REPORT_TITLE_LINES, REPORT_METADATA);
  drawReportHeading(ctx, `Resultado de evaluación: ${humanizeCode(ai.recommendation, "ADECUADO_CON_OBSERVACIONES")}`);
  drawCard(ctx, "Perfil ejecutivo", [text(ai.executive_profile ?? ai.executive_summary)]);
  drawCard(ctx, "Ajuste al cargo", [
    text(ai.adjustment_to_role ?? ai.job_fit_analysis, `Cargo evaluado: ${payload.candidate.job_position_name}. La compatibilidad se interpreta según las exigencias del puesto y los antecedentes disponibles.`),
  ]);
  const matrix = (ai.competency_matrix ?? []).map((item) => {
    const level = text(item.level, "S/E");
    const evidence = evidenceLevelLabel(text(item.evidence_level, "INSUFFICIENT_EVIDENCE"));
    return `${text(item.competency)} — Nivel ${level} (${evidence}). ${text(item.interpretation)}`;
  }).filter(Boolean);
  if (matrix.length) drawBulletSection(ctx, "Síntesis de competencias laborales", matrix, { tone: "default" });
  const integration = ai.evidence_integration;
  if (integration?.summary || integration?.convergences?.length || integration?.divergences?.length) {
    drawTwoColumnBulletCards(
      ctx,
      "Convergencias",
      [text(integration.summary), ...(integration.convergences ?? []).slice(0, 3).map((item) => text(item))].filter(Boolean),
      "Divergencias",
      (integration.divergences ?? []).slice(0, 3).map((item) => text(item)).filter(Boolean),
    );
  }
  drawTwoColumnBulletCards(
    ctx,
    "Fortalezas críticas",
    cleanList(ai.critical_strengths?.length ? ai.critical_strengths : ai.strengths, 4),
    "Brechas e incertidumbres",
    cleanList([...(ai.critical_gaps ?? []), ...(ai.critical_uncertainties ?? []), ...cleanList(ai.development_areas, 3)], 4),
  );

  drawInstrumentBars(ctx, "Personalidad laboral IPIP-16", dimensionEntries(payload.instruments.find((item) => item.code === "IPIP16_105")?.result ?? {}));
  drawCard(ctx, "Lectura laboral integrada", [
    text(ai.personality_profile?.summary ?? ai.ipip16?.summary),
    text(ai.personality_profile?.self_regulation),
    text(ai.personality_profile?.discipline_structure),
  ]);

  ensureSpace(ctx, 260);
  drawSectionTitle(ctx, "Estilo interpersonal IPIP-IPC");
  const ipc = payload.instruments.find((item) => item.code === "IPIP_IPC_32");
  if (ipc) {
    ensureSpace(ctx, 230);
    drawRadar(ctx.page, octantEntries(ipc.result), ctx.font, 175, ctx.y - 105, 88);
    let listY = ctx.y - 18;
    ctx.page.drawText("Octantes y macroestilos", { x: 330, y: listY, size: REPORT.h3, font: ctx.bold });
    listY -= 15;
    for (const entry of octantEntries(ipc.result).slice(0, 8)) {
      ctx.page.drawText(text(`${entry.code} - ${entry.name}: ${entry.mean.toFixed(2)}`), { x: 330, y: listY, size: REPORT.smallSize, font: ctx.font });
      listY -= REPORT.smallLineHeight;
    }
    ctx.y -= 230;
  }
  drawCard(ctx, "Interpretación laboral", [
    text(ai.interpersonal_profile?.summary ?? ai.ipc?.summary),
    text(ai.interpersonal_profile?.communication),
    text(ai.interpersonal_profile?.cooperation),
    text(ai.interpersonal_profile?.response_under_pressure),
  ]);

  ensureSpace(ctx, 260);
  drawSectionTitle(ctx, "Seguridad, impulsividad y conclusión");
  const barratt = payload.instruments.find((item) => item.code === "BARRATT_BIS11_30");
  const prp = payload.instruments.find((item) => item.code === "PRP_EMAIL_FORM_A_30");
  drawTwoColumnBulletCards(
    ctx,
    "BIS-11",
    [
      barratt ? formatResult(barratt.result) : "Resultado BIS-11 no disponible.",
      text(ai.safety_and_impulse_profile?.bis11 ?? ai.bis11?.impulsivity_interpretation),
    ],
    "PRP",
    [
      prp ? formatResult(prp.result) : "Resultado PRP no disponible.",
      text(ai.prp_assessment?.meaning),
      text(ai.safety_and_impulse_profile?.prp ?? ai.prp?.documentation_status),
    ],
  );
  drawCard(ctx, "Integración de seguridad", [text(ai.safety_and_impulse_profile?.combined_interpretation ?? ai.integrated_analysis)]);
  // Interview questions are working material for the preliminary review and
  // must not appear in the final signed report.
  drawCard(ctx, "Conclusión integrada", [
    text(ai.integrated_conclusion ?? ai.preliminary_conclusion),
    text(cleanList(ai.material_limitations ?? ai.limitations, 1).at(0), "Los resultados se interpretan como antecedentes psicolaborales del proceso y no constituyen diagnóstico clínico."),
  ]);
  drawPsychologistValidation(ctx);

  drawReportFooter(ctx, report.getPageCount());
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: corsHeaders,
    });
  }
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const secret = getSupabaseSecretKey();
  if (!url || authorization !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let assessmentId = "";
  const claimToken = crypto.randomUUID();
  let claimed = false;
  try {
    assessmentId = String(
      (await request.json() as { assessmentId?: unknown }).assessmentId ?? "",
    );
    const { data: psychologistReview, error: reviewError } = await client.rpc(
      "assert_psychologist_report_approved",
      { p_assessment_id: assessmentId },
    );
    if (reviewError || !psychologistReview) {
      throw new Error(reviewError?.message ?? "El informe requiere validación profesional");
    }
    const { data, error } = await client.rpc(
      "get_psycholaboral_certificate_payload",
      { p_assessment_id: assessmentId, p_claim_token: claimToken },
    );
    if (error || !data) {
      throw new Error(error?.message ?? "Evaluación no disponible");
    }
    claimed = true;
    const payload = { ...(data as Payload), psychologist_review: psychologistReview } as Payload;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const logo = await pdf.embedPng(
      bytesFromBase64(resolveLogo(payload.candidate.company_name)),
    );
    drawHeader(page, font, bold, logo, payload.public_id);
    let y = 635;
    const fields = [
      ["Candidato", payload.candidate.full_name],
      ["RUN", payload.candidate.national_id],
      ["Cargo", payload.candidate.job_position_name],
      ["Contrato", payload.candidate.contract_name],
      ["Proceso", payload.candidate.case_code],
      ["Término", formatDateTime(payload.completed_at)],
    ];
    for (const [label, value] of fields) {
      page.drawText(text(label), { x: 50, y, size: 9, font: bold });
      page.drawText(text(value), { x: 132, y, size: 9, font });
      y -= 19;
    }
    y -= 12;
    page.drawText("Certificado de Evaluación", {
      x: 50,
      y,
      size: 13,
      font: bold,
    });
    y -= 24;
    for (const instrument of payload.instruments) {
      page.drawText(text(instrument.name), { x: 50, y, size: 10, font: bold });
      y -= 15;
      for (
        const line of wrap(
          `${instrument.response_count} respuestas. ${
            formatResult(instrument.result)
          }`,
          font,
          8.5,
          500,
        )
      ) {
        page.drawText(line, { x: 60, y, size: 8.5, font });
        y -= 12;
      }
      for (
        const line of wrap(
          `Distribución de respuestas: ${
            responseSummary(instrument.response_summary)
          }`,
          font,
          7.5,
          500,
        )
      ) {
        page.drawText(line, {
          x: 60,
          y,
          size: 7.5,
          font,
          color: rgb(0.25, 0.28, 0.32),
        });
        y -= 11;
      }
      page.drawText(`Hash resultado: ${instrument.result_sha256}`, {
        x: 60,
        y,
        size: 6.5,
        font,
        color: rgb(0.45, 0.48, 0.52),
      });
      y -= 20;
    }
    page.drawText("Consentimientos", { x: 50, y, size: 11, font: bold });
    y -= 17;
    for (const consent of payload.consents) {
      page.drawText(
        `${consent.code} v${consent.version} - aceptado ${
          formatDateTime(consent.accepted_at)
        }`,
        { x: 60, y, size: 8, font },
      );
      y -= 12;
    }
    page.drawLine({
      start: { x: 205, y: 88 },
      end: { x: 407, y: 88 },
      thickness: 0.6,
      color: rgb(0.45, 0.48, 0.52),
    });
    page.drawText("Documento sellado digitalmente por el ERP", {
      x: 214,
      y: 76,
      size: 7.5,
      font: bold,
      color: rgb(0.3, 0.33, 0.37),
    });
    page.drawText(
      "Certificado de 1 página. Informe Psicolaboral Integrado: documento interno confidencial.",
      { x: 50, y: 55, size: 7.5, font, color: rgb(0.35, 0.38, 0.42) },
    );
    const certificateBytes = await pdf.save();
    const report = await PDFDocument.create();
    // Cada PDFDocument mantiene su propio contexto de recursos. No se pueden
    // reutilizar las fuentes/imágenes embebidas en el certificado anterior.
    const reportFont = await report.embedFont(StandardFonts.Helvetica);
    const reportBold = await report.embedFont(StandardFonts.HelveticaBold);
    report.registerFontkit(fontkit);
    const signature = await report.embedFont(bytesFromBase64(CERTIFICATE_SIGNATURE_FONT_BASE64), { subset: true });
    const reportLogo = await report.embedPng(
      bytesFromBase64(resolveLogo(payload.candidate.company_name)),
    );
    const ai = payload.ai_interpretation?.display_output ?? defaultAIOutput(payload);
    drawReportPdf(report, reportFont, reportBold, reportLogo, signature, payload, ai);

    const reportBytes = await report.save();
    const hash = await sha256(certificateBytes);
    const reportHash = await sha256(reportBytes);
    const path =
      `${payload.assessment_id}/certificado-psicolaboral-${payload.public_id}.pdf`;
    const reportPath = `${payload.assessment_id}/informe-psicolaboral-integrado-${payload.public_id}.pdf`;
    const { error: uploadError } = await client.storage.from(BUCKET).upload(
      path,
      certificateBytes,
      { contentType: "application/pdf", upsert: true },
    );
    if (uploadError) throw new Error(uploadError.message);
    const { error: reportUploadError } = await client.storage.from(BUCKET).upload(reportPath, reportBytes, { contentType: "application/pdf", upsert: true });
    if (reportUploadError) throw new Error(reportUploadError.message);
    const candidateDocumentPath = `psycholaboral-auto/${assessmentId}/informe-psicolaboral-integrado-${payload.public_id}.pdf`;
    const { error: candidateDocumentUploadError } = await client.storage
      .from(CANDIDATE_DOCUMENTS_BUCKET)
      .upload(candidateDocumentPath, reportBytes, { contentType: "application/pdf", upsert: true });
    if (candidateDocumentUploadError) throw new Error(`No fue posible cargar el informe en la ficha del candidato: ${candidateDocumentUploadError.message}`);
    const { data: candidateDocumentRegistration, error: candidateDocumentRegistrationError } = await client.rpc(
      "register_psycholaboral_report_document",
      { p_assessment_id: assessmentId, p_file_path: candidateDocumentPath, p_sha256: reportHash },
    );
    if (candidateDocumentRegistrationError) throw new Error(candidateDocumentRegistrationError.message);
    if (!(candidateDocumentRegistration as { stored?: boolean } | null)?.stored) {
      const { error: preservedFileCleanupError } = await client.storage
        .from(CANDIDATE_DOCUMENTS_BUCKET)
        .remove([candidateDocumentPath]);
      if (preservedFileCleanupError) throw new Error(`El informe quedó generado, pero no se pudo limpiar la copia automática preservando el documento manual: ${preservedFileCleanupError.message}`);
    }
    const { error: completeError } = await client.rpc(
      "complete_psycholaboral_certificate",
      {
        p_assessment_id: assessmentId,
        p_claim_token: claimToken,
        p_success: true,
        p_bucket: BUCKET,
        p_path: path,
        p_sha256: hash,
        p_error: null,
        p_report_bucket: BUCKET,
        p_report_path: reportPath,
        p_report_sha256: reportHash,
      },
    );
    if (completeError) throw new Error(completeError.message);
    return new Response(JSON.stringify({ generated: true, sha256: hash }), {
      headers: corsHeaders,
    });
  } catch (error) {
    if (assessmentId && claimed) {
      await client.rpc("complete_psycholaboral_certificate", {
        p_assessment_id: assessmentId,
        p_claim_token: claimToken,
        p_success: false,
        p_bucket: null,
        p_path: null,
        p_sha256: null,
        p_error: error instanceof Error ? error.message : "Error",
        p_report_bucket: null,
        p_report_path: null,
        p_report_sha256: null,
      });
    }
    return new Response(
      JSON.stringify({ error: publicErrorMessage(error) }),
      { status: 500, headers: corsHeaders },
    );
  }
});
