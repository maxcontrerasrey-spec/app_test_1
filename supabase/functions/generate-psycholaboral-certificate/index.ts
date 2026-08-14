import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
  JM_LOGO_BASE64,
} from "../generate-competency-certificate/logos.ts";

const BUCKET = "psychometric_documents";
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gestion.busesjm.cl",
  "Content-Type": "application/json",
};

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
    return `Dimensiones (media 1-5): ${namedScores(result.dimensions)}. Sin baremo chileno; requiere revisión profesional.`;
  }
  if (result.kind === "prp") {
    return `Puntaje directo: ${result.raw_total}. La interpretación de dimensiones y baremos queda pendiente de revisión profesional; no se muestran factores sin definición documentada.`;
  }
  return "Resultados disponibles para revisión profesional en el ERP.";
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

function text(value: unknown, fallback = "") {
  const candidate = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return safePdfText(candidate);
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

function defaultAIOutput(payload: Payload): PsychAIOutput {
  const evidence = payload.instruments.map((instrument) =>
    `${instrument.code}: ${instrument.response_count} respuestas, hash ${instrument.result_sha256.slice(0, 12)}`,
  );
  return {
    executive_summary:
      "Informe generado con interpretación determinística del ERP. No existe interpretación IA validada asociada a esta evaluación.",
    response_quality: payload.instruments.map((instrument) =>
      `${instrument.name}: ${instrument.quality?.status ?? "REVISAR"}`
    ).join("; "),
    strengths: [
      "Batería completada y puntuada por reglas backend versionadas.",
      "Resultados disponibles para contraste con entrevista profesional.",
      "Trazabilidad de scoring, calidad y consentimientos preservada.",
    ],
    development_areas: [
      "Profundizar patrones extremos o de baja variabilidad.",
      "Contrastar resultados con ejemplos laborales concretos.",
      "Revisar PRP con la documentación profesional disponible.",
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
      predominant_profile: "Perfil predominante pendiente de revisión profesional.",
      disc_disclaimer:
        "Este modelo interno no corresponde a DISC ni a Everything DiSC.",
    },
    bis11: {
      summary: "BIS-11 informa impulsividad como antecedente descriptivo.",
      impulsivity_interpretation:
        "Interpretar junto con entrevista, historial operacional y contexto del cargo.",
    },
    prp: {
      summary: "PRP conserva puntaje directo y factores documentados.",
      documentation_status:
        "La salida normativa permanece sujeta a revisión profesional cuando el material fuente sea ambiguo.",
    },
    integrated_analysis:
      "El análisis integrado combina resultados calculados, calidad de respuesta, perfil del cargo y entrevista; no emite decisión automática.",
    preliminary_conclusion:
      "Conclusión preliminar no decisoria. Requiere revisión profesional antes de usarse en el proceso.",
    limitations: [
      "No constituye diagnóstico clínico.",
      "No constituye decisión automática de contratación o rechazo.",
      "No reemplaza entrevista psicolaboral ni revisión profesional.",
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

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  logo: PDFImage,
  folio: string,
  pageNumber = 1,
  totalPages = 1,
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
  drawCenteredText(page, "Certificado de Evaluación", titleCell.x, height - 76, titleCell.width, bold, 19);
  drawCenteredText(page, "Psicolaboral", titleCell.x, height - 101, titleCell.width, bold, 19);
  page.drawText(`Folio: PS-${folio.slice(0, 8).toUpperCase()}`, {
    x: metadataCell.x + 8,
    y: height - 66,
    size: 8,
    font,
    color: muted,
  });
  page.drawText(`Página: ${pageNumber} de ${totalPages}`, {
    x: metadataCell.x + 8,
    y: height - 82,
    size: 8,
    font,
    color: muted,
  });
  page.drawLine({
    start: { x: header.x, y: header.y },
    end: { x: header.x + header.width, y: header.y },
    thickness: 2,
    color: accent,
  });
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
    const { data, error } = await client.rpc(
      "get_psycholaboral_certificate_payload",
      { p_assessment_id: assessmentId, p_claim_token: claimToken },
    );
    if (error || !data) {
      throw new Error(error?.message ?? "Evaluación no disponible");
    }
    claimed = true;
    const payload = data as Payload;
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
      "Certificado de 1 página. Informe Psicolaboral Integrado: documento interno separado para revisión profesional.",
      { x: 50, y: 55, size: 7.5, font, color: rgb(0.35, 0.38, 0.42) },
    );
    const certificateBytes = await pdf.save();
    const report = await PDFDocument.create();
    // Cada PDFDocument mantiene su propio contexto de recursos. No se pueden
    // reutilizar las fuentes/imágenes embebidas en el certificado anterior.
    const reportFont = await report.embedFont(StandardFonts.Helvetica);
    const reportBold = await report.embedFont(StandardFonts.HelveticaBold);
    const reportLogo = await report.embedPng(
      bytesFromBase64(resolveLogo(payload.candidate.company_name)),
    );
    const ai = payload.ai_interpretation?.display_output ?? defaultAIOutput(payload);
    const reportPage = report.addPage([612, 792]);
    const drawReportFooter = (target: PDFPage, pageNumber: number) => {
      target.drawText("Documento confidencial - Antecedente complementario - No decision automatica", { x: 50, y: 28, size: 7, font: reportFont, color: rgb(0.35, 0.38, 0.42) });
      target.drawText(`PS-${payload.public_id.slice(0, 8).toUpperCase()} - Informe integrado V5 - Pagina ${pageNumber} de 4`, { x: 360, y: 28, size: 7, font: reportFont, color: rgb(0.35, 0.38, 0.42) });
    };
    drawHeader(reportPage, reportFont, reportBold, reportLogo, payload.public_id, 1, 4);
    reportPage.drawText("Informe Psicolaboral Integrado", { x: 50, y: 635, size: 18, font: reportBold });
    reportPage.drawText("Perfil ejecutivo y ajuste laboral", { x: 50, y: 612, size: 11, font: reportFont });
    let reportY = 582;
    drawPanel(reportPage, "Perfil general", reportFont, reportBold, 45, 400, 522, 182);
    const summaryEndY = drawWrappedLines(
      reportPage,
      [text(ai.executive_profile ?? ai.executive_summary)],
      reportFont,
      8.6,
      58,
      548,
      496,
      10,
    );
    reportY = Math.min(382, summaryEndY - 16);
    reportPage.drawText("Ajuste al cargo", { x: 50, y: reportY, size: 12, font: reportBold });
    reportY -= 17;
    reportY = drawWrappedLines(reportPage, [
      text(ai.job_fit_analysis, `Cargo evaluado: ${payload.candidate.job_position_name}. La compatibilidad debe revisarse contra entrevista, evidencia documental y criterio profesional; el ERP no emite decision automatica.`),
    ], reportFont, 8.5, 58, reportY, 496, 6);
    drawPanel(reportPage, "Fortalezas", reportFont, reportBold, 45, 165, 250, 150);
    drawBulletList(reportPage, list(ai.strengths), reportFont, 8, 58, 278, 220, 5);
    drawPanel(reportPage, "Aspectos a profundizar", reportFont, reportBold, 317, 165, 250, 150);
    drawBulletList(reportPage, list(ai.development_areas), reportFont, 8, 330, 278, 220, 5);
    drawReportFooter(reportPage, 1);

    const ipipPage = report.addPage([612, 792]);
    drawHeader(ipipPage, reportFont, reportBold, reportLogo, payload.public_id, 2, 4);
    ipipPage.drawText("IPIP-16 - 16 dimensiones", { x: 50, y: 635, size: 16, font: reportBold });
    let ipipY = 606;
    const ipip = payload.instruments.find((item) => item.code === "IPIP16_105");
    if (ipip) {
      ipipY = drawBarChart(ipipPage, dimensionEntries(ipip.result), reportFont, reportBold, 52, ipipY, 500);
    }
    ipipY -= 18;
    ipipPage.drawText("Lectura laboral integrada", { x: 50, y: ipipY, size: 12, font: reportBold });
    ipipY -= 16;
    for (const [cluster, detail] of Object.entries(ai.ipip16?.clusters ?? {})) {
      ipipPage.drawText(text(clusterLabel(cluster)), { x: 58, y: ipipY, size: 8.5, font: reportBold });
      ipipY -= 11;
      ipipY = drawWrappedLines(ipipPage, [detail], reportFont, 7.8, 68, ipipY, 475, 2);
      ipipY -= 4;
    }
    ipipPage.drawText("Interpretacion IPIP-16", { x: 50, y: 112, size: 12, font: reportBold });
    drawWrappedLines(ipipPage, [text(ai.personality_profile?.summary ?? ai.ipip16?.summary)], reportFont, 8, 58, 94, 496, 5, rgb(0.22, 0.24, 0.29));
    drawReportFooter(ipipPage, 2);

    const ipcPage = report.addPage([612, 792]);
    drawHeader(ipcPage, reportFont, reportBold, reportLogo, payload.public_id, 3, 4);
    ipcPage.drawText("IPIP-IPC - 8 octantes y perfil conductual", { x: 50, y: 635, size: 16, font: reportBold });
    const ipc = payload.instruments.find((item) => item.code === "IPIP_IPC_32");
    if (ipc) drawRadar(ipcPage, octantEntries(ipc.result), reportFont, 175, 485, 92);
    let ipcY = 585;
    ipcPage.drawText("Octantes", { x: 330, y: ipcY, size: 12, font: reportBold });
    ipcY -= 17;
    if (ipc) {
      for (const entry of octantEntries(ipc.result)) {
        ipcPage.drawText(text(`${entry.code} - ${entry.name}: ${entry.mean.toFixed(2)}`), { x: 330, y: ipcY, size: 8, font: reportFont });
        ipcY -= 13;
      }
      const profile = ipc.result.labor_profile as { styles?: Record<string, number> } | undefined;
      ipcY -= 10;
      ipcPage.drawText("Macroestilos internos", { x: 330, y: ipcY, size: 11, font: reportBold });
      ipcY -= 15;
      for (const [label, value] of Object.entries(profile?.styles ?? {})) {
        ipcPage.drawText(text(`${label}: ${Number(value).toFixed(2)}`), { x: 330, y: ipcY, size: 8, font: reportFont });
        ipcY -= 13;
      }
    }
    drawPanel(ipcPage, "Interpretacion laboral", reportFont, reportBold, 45, 122, 522, 142);
    drawWrappedLines(ipcPage, [
      text(ai.interpersonal_profile?.summary ?? ai.ipc?.summary),
      text(ai.interpersonal_profile?.communication),
      text(ai.interpersonal_profile?.cooperation),
      text(ai.interpersonal_profile?.response_under_pressure),
      text(ai.ipc?.disc_disclaimer, "Este modelo interno no corresponde a DISC ni a Everything DiSC."),
    ], reportFont, 8.5, 58, 225, 496, 9);
    drawReportFooter(ipcPage, 3);

    const integrationPage = report.addPage([612, 792]);
    drawHeader(integrationPage, reportFont, reportBold, reportLogo, payload.public_id, 4, 4);
    integrationPage.drawText("BIS-11, PRP e integracion", { x: 50, y: 635, size: 16, font: reportBold });
    const barratt = payload.instruments.find((item) => item.code === "BARRATT_BIS11_30");
    const prp = payload.instruments.find((item) => item.code === "PRP_EMAIL_FORM_A_30");
    let integrationY = 606;
    drawPanel(integrationPage, "BIS-11", reportFont, reportBold, 45, 490, 250, 120);
    drawWrappedLines(integrationPage, [
      barratt ? formatResult(barratt.result) : "Resultado BIS-11 no disponible.",
      text(ai.safety_and_impulse_profile?.bis11 ?? ai.bis11?.impulsivity_interpretation),
    ], reportFont, 8.2, 58, 572, 220, 6);
    drawPanel(integrationPage, "PRP", reportFont, reportBold, 317, 490, 250, 120);
    drawWrappedLines(integrationPage, [
      prp ? formatResult(prp.result) : "Resultado PRP no disponible.",
      text(ai.safety_and_impulse_profile?.prp ?? ai.prp?.documentation_status),
    ], reportFont, 8.2, 330, 572, 220, 6);
    integrationY = 455;
    integrationPage.drawText("Analisis integrado", { x: 50, y: integrationY, size: 12, font: reportBold });
    integrationY -= 17;
    integrationY = drawWrappedLines(integrationPage, [text(ai.safety_and_impulse_profile?.combined_interpretation ?? ai.integrated_analysis)], reportFont, 8.5, 58, integrationY, 496, 7);
    integrationY -= 10;
    integrationPage.drawText("Preguntas sugeridas de entrevista", { x: 50, y: integrationY, size: 12, font: reportBold });
    integrationY -= 16;
    integrationY = drawBulletList(integrationPage, list(ai.interview_questions), reportFont, 8, 58, integrationY, 496, 6);
    integrationY -= 8;
    integrationPage.drawText("Conclusion integrada y advertencia metodologica", { x: 50, y: integrationY, size: 12, font: reportBold });
    integrationY -= 16;
    integrationY = drawWrappedLines(integrationPage, [text(ai.integrated_conclusion ?? ai.preliminary_conclusion)], reportFont, 8.5, 58, integrationY, 496, 4);
    drawWrappedLines(
      integrationPage,
      [text(list(ai.material_limitations).at(0) ?? list(ai.limitations).at(0), "Los resultados representan antecedentes complementarios de evaluación psicolaboral y deben ser considerados junto con entrevista, antecedentes laborales y demás información del proceso. No constituyen diagnóstico clínico ni una decisión automática de contratación.")],
      reportFont,
      7.8,
      58,
      Math.min(integrationY - 6, 158),
      496,
      4,
    );
    drawReportFooter(integrationPage, 4);

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
      JSON.stringify({ error: "No fue posible generar el certificado" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
