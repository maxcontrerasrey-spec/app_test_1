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
  const words = text.split(/\s+/);
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
  page.drawImage(logo, { x: 45, y: height - 105, width: 92, height: 50 });
  page.drawText("Certificado de Evaluación", {
    x: 175,
    y: height - 76,
    size: 20,
    font: bold,
    color: rgb(0.07, 0.08, 0.1),
  });
  page.drawText("Psicolaboral", {
    x: 230,
    y: height - 101,
    size: 20,
    font: bold,
    color: rgb(0.07, 0.08, 0.1),
  });
  page.drawText(`Folio: PS-${folio.slice(0, 8).toUpperCase()}`, {
    x: width - 170,
    y: height - 66,
    size: 8,
    font,
    color: rgb(0.4, 0.44, 0.5),
  });
  page.drawText(`Página: ${pageNumber} de ${totalPages}`, {
    x: width - 170,
    y: height - 82,
    size: 8,
    font,
    color: rgb(0.4, 0.44, 0.5),
  });
  page.drawLine({
    start: { x: 45, y: height - 122 },
    end: { x: width - 45, y: height - 122 },
    thickness: 2,
    color: rgb(0.75, 0.07, 0.09),
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
      page.drawText(label, { x: 50, y, size: 9, font: bold });
      page.drawText(String(value ?? ""), { x: 132, y, size: 9, font });
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
      page.drawText(instrument.name, { x: 50, y, size: 10, font: bold });
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
    const reportPage = report.addPage([612, 792]);
    const drawReportFooter = (target: PDFPage, pageNumber: number) => {
      target.drawText("Documento confidencial · Antecedente complementario · No decisión automática", { x: 50, y: 28, size: 7, font, color: rgb(0.35, 0.38, 0.42) });
      target.drawText(`PS-${payload.public_id.slice(0, 8).toUpperCase()} · Informe v1 · Página ${pageNumber} de 3`, { x: 390, y: 28, size: 7, font, color: rgb(0.35, 0.38, 0.42) });
    };
    drawHeader(reportPage, font, bold, logo, payload.public_id, 1, 3);
    reportPage.drawText("Informe Psicolaboral Integrado", { x: 50, y: 635, size: 18, font: bold });
    reportPage.drawText("Resumen ejecutivo y calidad de respuestas", { x: 50, y: 612, size: 11, font });
    let reportY = 580;
    reportPage.drawText("Calidad y consistencia", { x: 50, y: reportY, size: 12, font: bold });
    reportY -= 22;
    for (const instrument of payload.instruments) {
      const quality = instrument.quality ?? {};
      reportPage.drawText(`${instrument.name}: ${quality.status ?? "REVISAR"}`, { x: 60, y: reportY, size: 9, font: bold });
      reportY -= 14;
      reportPage.drawText(`Completitud ${quality.completitud ?? 0}% · ${quality.items_respondidos ?? instrument.response_count} respuestas · valores distintos ${quality.valores_distintos ?? "—"}`, { x: 70, y: reportY, size: 8, font });
      reportY -= 13;
      if (quality.motivos?.length) { reportPage.drawText(`A profundizar: ${quality.motivos.join("; ")}`, { x: 70, y: reportY, size: 8, font, color: rgb(0.45, 0.28, 0.12) }); reportY -= 13; }
    }
    reportY -= 12;
    reportPage.drawText("Conclusión", { x: 50, y: reportY, size: 12, font: bold });
    reportY -= 18;
    for (const line of wrap("No se emite una conclusión automática de aptitud, contratación o rechazo. La interpretación requiere revisión profesional y evidencia complementaria del proceso.", font, 9, 500)) { reportPage.drawText(line, { x: 60, y: reportY, size: 9, font }); reportY -= 13; }
    drawReportFooter(reportPage, 1);
    const ipipPage = report.addPage([612, 792]);
    drawHeader(ipipPage, font, bold, logo, payload.public_id, 2, 3);
    ipipPage.drawText("IPIP-16 · 16 dimensiones", { x: 50, y: 635, size: 16, font: bold });
    let ipipY = 605;
    const ipip = payload.instruments.find((item) => item.code === "IPIP16_105");
    if (ipip) for (const line of wrap(formatResult(ipip.result), font, 9, 500)) { ipipPage.drawText(line, { x: 55, y: ipipY, size: 9, font }); ipipY -= 14; }
    ipipPage.drawText("Adaptación lingüística interna; sin baremo chileno validado. Las medias 1–5 no son percentiles.", { x: 55, y: ipipY - 10, size: 8, font, color: rgb(0.45, 0.28, 0.12) });
    drawReportFooter(ipipPage, 2);
    const ipcPage = report.addPage([612, 792]);
    drawHeader(ipcPage, font, bold, logo, payload.public_id, 3, 3);
    ipcPage.drawText("IPIP-IPC · 8 octantes y perfil conductual", { x: 50, y: 635, size: 16, font: bold });
    let ipcY = 605;
    const ipc = payload.instruments.find((item) => item.code === "IPIP_IPC_32");
    if (ipc) for (const line of wrap(formatResult(ipc.result), font, 9, 500)) { ipcPage.drawText(line, { x: 55, y: ipcY, size: 9, font }); ipcY -= 14; }
    for (const line of wrap("Perfil Conductual Laboral: interpretación interna del ERP en cuatro macroestilos (Directivo, Influyente, Estable y Analítico). No es DISC, no utiliza contenido de Everything DiSC y no constituye una equivalencia psicométrica validada.", font, 9, 500)) { ipcPage.drawText(line, { x: 55, y: ipcY - 15, size: 9, font }); ipcY -= 13; }
    drawReportFooter(ipcPage, 3);
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
