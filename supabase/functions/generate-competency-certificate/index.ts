import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";
import { extractBukDocumentMetadata, uploadBukDocument } from "../_shared/bukDocuments.ts";
import {
  CONSORCIO_ANDINO_LOGO_BASE64,
  CONSORCIO_NUEVO_NORTE_LOGO_BASE64,
  JM_LOGO_BASE64
} from "./logos.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const BUCKET = "competency_documents";
const BUK_FOLDER = "Competencias";

type CompetencyRequestRow = {
  id: string;
  worker_buk_employee_id: string;
  worker_document_number: string;
  worker_full_name: string;
  worker_job_title: string | null;
  worker_area_name: string | null;
  worker_contract_code: string | null;
  instructor_id: string;
  training_date: string;
  training_location: string | null;
  model_summary: string;
  created_by: string;
};

type InstructorRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  document_number: string;
  profile_code: string;
  signature_label: string | null;
};

type EvaluationRow = {
  id: string;
  final_score: number;
  evaluation_status: string;
  file_bucket: string;
  file_path: string;
  file_sha256: string;
};

type CertificateRow = {
  id: string;
  folio: string;
  verification_token: string;
  certificate_status: string;
  pdf_path: string | null;
  buk_upload_status: string;
};

type AuthorizedModelRow = {
  brand_name: string;
  type_name: string;
  model_name: string;
};

type ActiveEmployeeCompanyRow = {
  raw_payload: Record<string, unknown> | null;
  area_name: string | null;
};

function requireEnv(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing ${label}`);
  }

  return normalized;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeDocumentToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function buildBukFileName(request: CompetencyRequestRow, certificate: CertificateRow) {
  const rut = normalizeDocumentToken(request.worker_document_number);
  const models = normalizeDocumentToken(request.model_summary).slice(0, 90);
  const date = request.training_date.replace(/-/g, "");
  return `COMPETENCIA_${rut}_${models}_${date}_${normalizeDocumentToken(certificate.folio)}.pdf`;
}

function buildVerificationUrl(token: string) {
  const baseUrl = (Deno.env.get("PUBLIC_APP_URL") ?? Deno.env.get("APP_PUBLIC_URL") ?? "").trim();
  const normalizedBase = baseUrl ? baseUrl.replace(/\/+$/, "") : "https://erp.busesjm.com";
  return `${normalizedBase}/verificar/competencia/${encodeURIComponent(token)}`;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",").at(-1) ?? "" : dataUrl;
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return [day, month, year].filter(Boolean).join("-");
}

function addYears(dateValue: string, years: number) {
  const source = new Date(`${dateValue}T12:00:00Z`);
  source.setUTCFullYear(source.getUTCFullYear() + years);
  return source.toISOString().slice(0, 10);
}

function normalizeCompanyName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function readNestedText(source: Record<string, unknown> | null | undefined, path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function extractCompanyNameFromBukPayload(payload: Record<string, unknown> | null | undefined) {
  return (
    readNestedText(payload, ["company_name"]) ||
    readNestedText(payload, ["company", "name"]) ||
    readNestedText(payload, ["current_job", "company", "name"]) ||
    readNestedText(payload, ["current_job", "company_name"]) ||
    readNestedText(payload, ["current_job", "legal_entity", "name"]) ||
    readNestedText(payload, ["legal_entity", "name"])
  );
}

function resolveLogoBase64(companyName: string | null | undefined) {
  const normalized = normalizeCompanyName(companyName);
  if (normalized.includes("consorcio andino")) {
    return CONSORCIO_ANDINO_LOGO_BASE64;
  }
  if (normalized.includes("consorcio nuevo norte")) {
    return CONSORCIO_NUEVO_NORTE_LOGO_BASE64;
  }
  return JM_LOGO_BASE64;
}

function readLogoBytes(companyName: string | null | undefined) {
  return dataUrlToBytes(resolveLogoBase64(companyName));
}

function splitTextIntoLines(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawCenteredText(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number) {
  page.drawText(text, {
    x: x + (width - font.widthOfTextAtSize(text, size)) / 2,
    y,
    size,
    font,
    color: rgb(0.09, 0.09, 0.11)
  });
}

function drawFittedText(page: PDFPage, text: string, options: {
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  size: number;
}) {
  if (options.font.widthOfTextAtSize(text, options.size) <= options.width) {
    page.drawText(text, {
      x: options.x,
      y: options.y,
      size: options.size,
      font: options.font,
      color: rgb(0.11, 0.13, 0.16)
    });
    return;
  }

  const ellipsis = "...";
  let fitted = text;
  while (fitted.length > 1 && options.font.widthOfTextAtSize(`${fitted}${ellipsis}`, options.size) > options.width) {
    fitted = fitted.slice(0, -1);
  }

  page.drawText(`${fitted.trimEnd()}${ellipsis}`, {
    x: options.x,
    y: options.y,
    size: options.size,
    font: options.font,
    color: rgb(0.11, 0.13, 0.16)
  });
}

function drawScaledText(page: PDFPage, text: string, options: {
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  size: number;
  minSize: number;
}) {
  let size = options.size;
  while (size > options.minSize && options.font.widthOfTextAtSize(text, size) > options.width) {
    size -= 0.5;
  }

  page.drawText(text, {
    x: options.x,
    y: options.y,
    size,
    font: options.font,
    color: rgb(0.08, 0.09, 0.11)
  });
}

function drawJustifiedLine(page: PDFPage, line: string, options: {
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  size: number;
}) {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    page.drawText(line, { x: options.x, y: options.y, size: options.size, font: options.font, color: rgb(0.12, 0.12, 0.14) });
    return;
  }

  const wordsWidth = words.reduce((total, word) => total + options.font.widthOfTextAtSize(word, options.size), 0);
  const gap = (options.width - wordsWidth) / (words.length - 1);

  if (!Number.isFinite(gap) || gap < 2 || gap > 9) {
    page.drawText(line, { x: options.x, y: options.y, size: options.size, font: options.font, color: rgb(0.12, 0.12, 0.14) });
    return;
  }

  let cursorX = options.x;
  for (const word of words) {
    page.drawText(word, { x: cursorX, y: options.y, size: options.size, font: options.font, color: rgb(0.12, 0.12, 0.14) });
    cursorX += options.font.widthOfTextAtSize(word, options.size) + gap;
  }
}

function drawParagraph(page: PDFPage, text: string, options: {
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
}) {
  const lines = splitTextIntoLines(text, options.font, options.size, options.width);
  let nextY = options.y;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (index < lines.length - 1) {
      drawJustifiedLine(page, line, { ...options, y: nextY });
    } else {
      page.drawText(line, {
        x: options.x,
        y: nextY,
        size: options.size,
        font: options.font,
        color: rgb(0.12, 0.12, 0.14)
      });
    }
    nextY -= options.lineHeight;
  }

  return nextY - 8;
}

function buildModelRowsFromSummary(modelSummary: string): AuthorizedModelRow[] {
  return [{
    brand_name: "",
    type_name: "",
    model_name: modelSummary
  }];
}

function drawModelSummary(
  page: PDFPage,
  rows: AuthorizedModelRow[],
  fonts: { regular: PDFFont; bold: PDFFont },
  tableY: number
) {
  const tableX = 82;
  const tableWidth = 431;
  const headerHeight = 22;
  const rowHeight = 20;
  const columns = [128, 128, 175];
  const visibleRows = rows.slice(0, 7);

  page.drawRectangle({
    x: tableX,
    y: tableY - headerHeight - visibleRows.length * rowHeight,
    width: tableWidth,
    height: headerHeight + visibleRows.length * rowHeight,
    borderColor: rgb(0.28, 0.31, 0.36),
    borderWidth: 0.7
  });
  page.drawRectangle({
    x: tableX,
    y: tableY - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: rgb(0.95, 0.96, 0.97)
  });

  let x = tableX;
  ["Marca", "Tipo", "Modelo autorizado"].forEach((label, index) => {
    page.drawText(label, { x: x + 8, y: tableY - 15, size: 9, font: fonts.bold, color: rgb(0.17, 0.2, 0.25) });
    if (index < columns.length - 1) {
      page.drawLine({
        start: { x: x + columns[index], y: tableY },
        end: { x: x + columns[index], y: tableY - headerHeight - visibleRows.length * rowHeight },
        thickness: 0.5,
        color: rgb(0.55, 0.58, 0.62)
      });
    }
    x += columns[index];
  });

  for (let index = 0; index < visibleRows.length; index += 1) {
    const row = visibleRows[index];
    const y = tableY - headerHeight - (index + 1) * rowHeight;
    page.drawLine({
      start: { x: tableX, y: y + rowHeight },
      end: { x: tableX + tableWidth, y: y + rowHeight },
      thickness: 0.45,
      color: rgb(0.74, 0.76, 0.8)
    });
    drawFittedText(page, row.brand_name, { x: tableX + 8, y: y + 6, width: columns[0] - 16, size: 8.5, font: fonts.regular });
    drawFittedText(page, row.type_name, { x: tableX + columns[0] + 8, y: y + 6, width: columns[1] - 16, size: 8.5, font: fonts.regular });
    drawFittedText(page, row.model_name, { x: tableX + columns[0] + columns[1] + 8, y: y + 6, width: columns[2] - 16, size: 8.5, font: fonts.regular });
  }
}

async function buildCertificatePdf(input: {
  request: CompetencyRequestRow;
  instructor: InstructorRow;
  certificate: CertificateRow;
  issuedDate: string;
  validUntil: string;
  authorizedModels: AuthorizedModelRow[];
  workerCompanyName: string | null;
}) {
  const { request, instructor, certificate, issuedDate, validUntil, authorizedModels, workerCompanyName } = input;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const signatureFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const logo = await pdfDoc.embedPng(await readLogoBytes(workerCompanyName));
  const black = rgb(0.08, 0.09, 0.11);
  const border = rgb(0.25, 0.28, 0.33);
  const muted = rgb(0.42, 0.45, 0.5);

  page.drawRectangle({ x: 52, y: 718, width: 491, height: 86, borderColor: border, borderWidth: 0.8 });
  page.drawLine({ start: { x: 178, y: 718 }, end: { x: 178, y: 804 }, thickness: 0.6, color: border });
  page.drawLine({ start: { x: 446, y: 718 }, end: { x: 446, y: 804 }, thickness: 0.6, color: border });
  page.drawImage(logo, { x: 84, y: 734, width: 62, height: 62 });
  drawCenteredText(page, "Certificado de Acreditacion de", 178, 770, 268, bold, 17);
  drawCenteredText(page, "Competencias", 178, 742, 268, bold, 17);
  page.drawText("Codigo: F-OPE-068", { x: 456, y: 785, size: 8.5, font: regular, color: black });
  page.drawText("Fecha: 01-08-2024", { x: 456, y: 763, size: 8.5, font: regular, color: black });
  page.drawText("Version: 00", { x: 456, y: 741, size: 8.5, font: regular, color: black });
  page.drawText("Pagina: 1 de 1", { x: 456, y: 724, size: 8.5, font: regular, color: black });

  const bodyX = 82;
  const bodyWidth = 431;
  let y = 625;
  y = drawParagraph(page, `Sr. ${instructor.full_name}, Rut ${instructor.document_number}, Instructor de conductores, certifica que el conductor Sr. ${request.worker_full_name}, Rut ${request.worker_document_number}, ha realizado satisfactoriamente el proceso de capacitacion e induccion en conduccion y operacion de los equipos detallados en el cuadro de autorizacion.`, {
    x: bodyX,
    y,
    width: bodyWidth,
    font: regular,
    size: 10.3,
    lineHeight: 15
  });
  y = drawParagraph(page, "Segun lo establecido por la empresa y de acuerdo con la evaluacion del examen Teorico y Practico de conduccion donde obtuvo una calificacion del 100%, se encuentra acreditado con las competencias especificas para conducir y operar los equipos senalados.", {
    x: bodyX,
    y,
    width: bodyWidth,
    font: regular,
    size: 10.3,
    lineHeight: 15
  });
  y = drawParagraph(page, `Con fecha ${formatDate(request.training_date)} queda HABILITADO para operar los equipos indicados.`, {
    x: bodyX,
    y,
    width: bodyWidth,
    font: regular,
    size: 10.3,
    lineHeight: 15
  });

  drawModelSummary(page, authorizedModels.length > 0 ? authorizedModels : buildModelRowsFromSummary(request.model_summary), { regular, bold }, y - 6);

  const panelX = 105;
  const panelY = 58;
  const panelW = 385;
  const panelH = 190;
  page.drawRectangle({ x: panelX, y: panelY, width: panelW, height: panelH, borderColor: border, borderWidth: 0.65 });
  page.drawLine({ start: { x: panelX, y: panelY + panelH - 24 }, end: { x: panelX + panelW, y: panelY + panelH - 24 }, thickness: 0.5, color: border });
  page.drawLine({ start: { x: panelX + 230, y: panelY + 58 }, end: { x: panelX + 230, y: panelY + panelH }, thickness: 0.5, color: border });
  drawCenteredText(page, "Firma instructor", panelX, panelY + panelH - 17, 230, bold, 11);
  drawCenteredText(page, "Codigo QR Instructor", panelX + 230, panelY + panelH - 17, 155, bold, 11);
  page.drawText("Firmado digitalmente por:", { x: panelX + 12, y: panelY + 122, size: 10.2, font: regular, color: black });
  drawScaledText(page, instructor.signature_label || instructor.full_name, {
    x: panelX + 12,
    y: panelY + 92,
    width: 202,
    size: 18,
    minSize: 12,
    font: signatureFont
  });
  page.drawText(`el ${formatDate(issuedDate)}`, { x: panelX + 12, y: panelY + 70, size: 10.2, font: regular, color: muted });
  page.drawRectangle({ x: panelX + 188, y: panelY + 66, width: 18, height: 18, color: rgb(0.16, 0.58, 0.82) });
  page.drawText("OK", { x: panelX + 192, y: panelY + 72, size: 5.2, font: bold, color: rgb(1, 1, 1) });

  const qrDataUrl = await QRCode.toDataURL(buildVerificationUrl(certificate.verification_token), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 150
  });
  const qrPng = await pdfDoc.embedPng(dataUrlToBytes(qrDataUrl));
  page.drawImage(qrPng, { x: panelX + 267, y: panelY + 72, width: 78, height: 78 });

  [["Codigo Perfil", instructor.profile_code], ["Codigo Certificado", certificate.folio], ["Vencimiento de certificado", formatDate(validUntil)]].forEach((row, index) => {
    const rowY = panelY + 38 - index * 20;
    page.drawLine({ start: { x: panelX, y: rowY + 20 }, end: { x: panelX + panelW, y: rowY + 20 }, thickness: 0.45, color: border });
    page.drawLine({ start: { x: panelX + 172, y: rowY }, end: { x: panelX + 172, y: rowY + 20 }, thickness: 0.45, color: border });
    page.drawText(row[0], { x: panelX + 8, y: rowY + 6, size: 9.5, font: bold, color: black });
    page.drawText(row[1], { x: panelX + 180, y: rowY + 6, size: 9.2, font: regular, color: black });
  });

  return pdfDoc.save();
}

async function assertAuthorizedUser(
  supabase: ReturnType<typeof createClient>,
  accessToken: string,
  request: CompetencyRequestRow,
  instructor: InstructorRow
) {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_super_admin === true || request.created_by === user.id || instructor.user_id === user.id) {
    return user.id;
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("app_roles(code)")
    .eq("user_id", user.id);

  const roleCodes = (roles ?? [])
    .map((row: { app_roles?: { code?: string } | null }) => row.app_roles?.code)
    .filter(Boolean);

  if (roleCodes.includes("certificaciones")) {
    return user.id;
  }

  throw new Error("Sin permisos para generar este certificado.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const accessToken = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      throw new Error("Unauthorized");
    }

    const { requestId } = await req.json();
    if (typeof requestId !== "string" || !requestId.trim()) {
      throw new Error("requestId es requerido.");
    }

    const supabaseUrl = requireEnv(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
    const serviceRoleKey = requireEnv(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: requestRow, error: requestError } = await supabase
      .from("competency_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle<CompetencyRequestRow>();

    if (requestError || !requestRow) {
      throw new Error(requestError?.message || "Solicitud de competencia no encontrada.");
    }

    const { data: instructorRow, error: instructorError } = await supabase
      .from("competency_instructors")
      .select("*")
      .eq("id", requestRow.instructor_id)
      .maybeSingle<InstructorRow>();

    if (instructorError || !instructorRow) {
      throw new Error(instructorError?.message || "Instructor no encontrado.");
    }

    const actorId = await assertAuthorizedUser(supabase, accessToken, requestRow, instructorRow);

    const { data: evaluationRow, error: evaluationError } = await supabase
      .from("competency_evaluations")
      .select("*")
      .eq("request_id", requestId)
      .eq("evaluation_status", "approved")
      .order("attempt_number", { ascending: false })
      .limit(1)
      .maybeSingle<EvaluationRow>();

    if (evaluationError || !evaluationRow) {
      throw new Error(evaluationError?.message || "No existe evaluacion aprobada para esta solicitud.");
    }

    if (Number(evaluationRow.final_score) !== 100) {
      throw new Error("La evaluacion aprobada debe tener nota final 100%.");
    }

    const { error: evaluationDownloadError } = await supabase.storage
      .from(evaluationRow.file_bucket || BUCKET)
      .download(evaluationRow.file_path);

    if (evaluationDownloadError) {
      throw new Error(`No fue posible validar el archivo de evaluacion: ${evaluationDownloadError.message}`);
    }

    const { data: certificateRow, error: certificateError } = await supabase
      .from("competency_certificates")
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle<CertificateRow>();

    if (certificateError || !certificateRow) {
      throw new Error(certificateError?.message || "Certificado no inicializado.");
    }

    if (certificateRow.certificate_status === "uploaded_to_buk" && certificateRow.pdf_path) {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyGenerated: true,
          folio: certificateRow.folio,
          pdfPath: certificateRow.pdf_path,
          bukUploadStatus: certificateRow.buk_upload_status
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("competency_certificates")
      .update({
        certificate_status: "generating",
        buk_attempt_count: (certificateRow.buk_upload_status === "failed" ? 1 : 0) + 1,
        buk_last_error: null,
        generated_by: actorId
      })
      .eq("id", certificateRow.id);

    const issuedDate = new Date().toISOString().slice(0, 10);
    const validUntil = addYears(requestRow.training_date, 2);
    const { data: requestModelRows, error: requestModelsError } = await supabase
      .from("competency_request_models")
      .select("model_id")
      .eq("request_id", requestId);

    if (requestModelsError) {
      throw new Error(`No fue posible cargar modelos autorizados: ${requestModelsError.message}`);
    }

    const modelIds = (requestModelRows ?? [])
      .map((row: { model_id?: string | null }) => row.model_id)
      .filter((modelId): modelId is string => Boolean(modelId));

    let authorizedModels: AuthorizedModelRow[] = [];
    if (modelIds.length > 0) {
      const { data: modelRows, error: modelsError } = await supabase
        .from("competency_equipment_models")
        .select("id, name, competency_equipment_brands(name), competency_equipment_types(name)")
        .in("id", modelIds);

      if (modelsError) {
        throw new Error(`No fue posible cargar detalle de modelos autorizados: ${modelsError.message}`);
      }

      authorizedModels = modelIds
        .map((modelId) => (modelRows ?? []).find((row: Record<string, unknown>) => row.id === modelId))
        .filter((row): row is Record<string, unknown> => Boolean(row))
        .map((row) => {
          const brand = row.competency_equipment_brands as { name?: string } | null;
          const type = row.competency_equipment_types as { name?: string } | null;
          return {
            brand_name: brand?.name ?? "",
            type_name: type?.name ?? "",
            model_name: typeof row.name === "string" ? row.name : ""
          };
        });
    }

    const { data: employeeCompanyRow } = await supabase
      .from("employees_active_current")
      .select("raw_payload, area_name")
      .eq("buk_employee_id", requestRow.worker_buk_employee_id)
      .maybeSingle<ActiveEmployeeCompanyRow>();

    const workerCompanyName = extractCompanyNameFromBukPayload(employeeCompanyRow?.raw_payload);
    const pdfBytes = await buildCertificatePdf({
      request: requestRow,
      instructor: instructorRow,
      certificate: certificateRow,
      issuedDate,
      validUntil,
      authorizedModels,
      workerCompanyName
    });
    const pdfHash = await sha256Hex(pdfBytes);
    const pdfPath = `certificates/${certificateRow.id}/${certificateRow.folio}.pdf`;
    const bukFileName = buildBukFileName(requestRow, certificateRow);

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true
    });

    if (uploadError) {
      throw new Error(`No fue posible guardar el PDF: ${uploadError.message}`);
    }

    let bukUploadStatus: "success" | "failed" = "success";
    let bukDocumentId: string | null = null;
    let bukDocumentUrl: string | null = null;
    let bukError: string | null = null;

    try {
      const uploadResult = await uploadBukDocument(
        requestRow.worker_buk_employee_id,
        bukFileName,
        new Blob([pdfBytes], { type: "application/pdf" }),
        { path: BUK_FOLDER }
      );
      const metadata = extractBukDocumentMetadata(uploadResult.payload);
      bukDocumentId = metadata.bukDocumentId;
      bukDocumentUrl = metadata.bukDocumentUrl;
    } catch (error) {
      bukUploadStatus = "failed";
      bukError = toErrorMessage(error);
    }

    const finalCertificateStatus = bukUploadStatus === "success" ? "uploaded_to_buk" : "buk_upload_failed";
    const { error: updateError } = await supabase
      .from("competency_certificates")
      .update({
        issued_at: new Date().toISOString(),
        valid_from: requestRow.training_date,
        valid_until: validUntil,
        certificate_status: finalCertificateStatus,
        competency_status: "enabled",
        pdf_path: pdfPath,
        pdf_file_name: `${certificateRow.folio}.pdf`,
        pdf_sha256: pdfHash,
        pdf_size_bytes: pdfBytes.byteLength,
        buk_upload_status: bukUploadStatus,
        buk_folder_name: BUK_FOLDER,
        buk_document_id: bukDocumentId,
        buk_document_url: bukDocumentUrl,
        buk_uploaded_at: bukUploadStatus === "success" ? new Date().toISOString() : null,
        buk_last_error: bukError,
        generated_by: actorId
      })
      .eq("id", certificateRow.id);

    if (updateError) {
      throw new Error(`No fue posible actualizar el certificado: ${updateError.message}`);
    }

    await supabase
      .from("competency_requests")
      .update({
        request_status: "completed",
        completed_at: new Date().toISOString(),
        updated_by: actorId
      })
      .eq("id", requestId);

    await supabase.from("competency_audit_log").insert({
      request_id: requestId,
      certificate_id: certificateRow.id,
      event_type: "certificate_generated",
      event_summary:
        bukUploadStatus === "success"
          ? "Certificado generado y cargado en BUK"
          : "Certificado generado con carga BUK pendiente",
      payload: {
        folio: certificateRow.folio,
        pdf_path: pdfPath,
        pdf_sha256: pdfHash,
        buk_upload_status: bukUploadStatus,
        buk_document_id: bukDocumentId,
        buk_error: bukError
      },
      actor_id: actorId
    });

    return new Response(
      JSON.stringify({
        success: true,
        folio: certificateRow.folio,
        verificationToken: certificateRow.verification_token,
        pdfPath,
        pdfHash,
        bukUploadStatus,
        bukDocumentId,
        bukDocumentUrl,
        bukError
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = toErrorMessage(error);
    const status = message === "Unauthorized" ? 401 : message.includes("Sin permisos") ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
