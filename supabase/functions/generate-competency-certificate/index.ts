import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";
import { extractBukDocumentMetadata, uploadBukDocument } from "../_shared/bukDocuments.ts";
import {
  CERTIFICATE_BUS_ICON_BASE64,
  CERTIFICATE_SIGNATURE_FONT_BASE64,
  CERTIFICATE_VALIDATION_BADGE_BASE64,
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
const DEFAULT_PUBLIC_APP_BASE_URL = "https://gestion.busesjm.cl";

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

type CompanyResolutionClient = ReturnType<typeof createClient>;

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
  const normalizedBase = baseUrl && !baseUrl.includes("pages.dev")
    ? baseUrl.replace(/\/+$/, "")
    : DEFAULT_PUBLIC_APP_BASE_URL;
  return `${normalizedBase}/verificar/competencia/${encodeURIComponent(token)}`;
}

async function refreshPublicValidationSnapshot(
  supabase: ReturnType<typeof createClient>,
  certificateId: string
) {
  const { error } = await supabase.rpc("refresh_competency_certificate_public_snapshot", {
    certificate_id_input: certificateId
  });

  if (error) {
    throw new Error(`No fue posible actualizar el registro publico de validacion: ${error.message}`);
  }
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

function formatLongDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  const monthName = [
    "",
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre"
  ][Number(month)];

  return `${Number(day)} de ${monthName} de ${year}`;
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

async function resolveWorkerCompanyName(
  supabase: CompanyResolutionClient,
  employeeRow: ActiveEmployeeCompanyRow | null | undefined
) {
  const fallbackCompanyName =
    extractCompanyNameFromBukPayload(employeeRow?.raw_payload) ||
    employeeRow?.area_name ||
    null;

  const { data, error } = await supabase.rpc("resolve_active_employee_company_name", {
    p_payload: employeeRow?.raw_payload ?? {},
    p_area_name: employeeRow?.area_name ?? null
  });

  if (error || typeof data !== "string" || !data.trim()) {
    return fallbackCompanyName;
  }

  return data.trim();
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

function drawRichParagraph(page: PDFPage, segments: Array<{ text: string; font: PDFFont; color?: ReturnType<typeof rgb> }>, options: {
  x: number;
  y: number;
  width: number;
  size: number;
  lineHeight: number;
}) {
  const words = segments.flatMap((segment) =>
    segment.text.split(/\s+/).filter(Boolean).map((word) => ({
      text: word,
      font: segment.font,
      color: segment.color ?? rgb(0.08, 0.09, 0.14)
    }))
  );
  const lines: Array<typeof words> = [];
  let current: typeof words = [];
  let currentWidth = 0;
  const spaceWidth = options.size * 0.28;

  for (const word of words) {
    const wordWidth = word.font.widthOfTextAtSize(word.text, options.size);
    const nextWidth = current.length === 0 ? wordWidth : currentWidth + spaceWidth + wordWidth;
    if (current.length > 0 && nextWidth > options.width) {
      lines.push(current);
      current = [word];
      currentWidth = wordWidth;
    } else {
      current.push(word);
      currentWidth = nextWidth;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  let y = options.y;
  lines.forEach((line, lineIndex) => {
    const lineWordsWidth = line.reduce((total, word) => total + word.font.widthOfTextAtSize(word.text, options.size), 0);
    const shouldJustify = lineIndex < lines.length - 1 && line.length > 2;
    const gap = shouldJustify ? Math.min(10, Math.max(spaceWidth, (options.width - lineWordsWidth) / (line.length - 1))) : spaceWidth;
    let x = options.x;

    line.forEach((word) => {
      page.drawText(word.text, { x, y, size: options.size, font: word.font, color: word.color });
      x += word.font.widthOfTextAtSize(word.text, options.size) + gap;
    });

    y -= options.lineHeight;
  });

  return y - 12;
}

const FIRST_PAGE_MODEL_CAPACITY = 6;
const CONTINUATION_PAGE_MODEL_CAPACITY = 18;
const LAST_PAGE_MODEL_CAPACITY = 18;

function calculateCertificatePageCount(modelCount: number) {
  if (modelCount <= FIRST_PAGE_MODEL_CAPACITY) {
    return 1;
  }

  return 1 + Math.ceil((modelCount - FIRST_PAGE_MODEL_CAPACITY) / CONTINUATION_PAGE_MODEL_CAPACITY);
}

function drawCertificateHeader(
  page: PDFPage,
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  fonts: { regular: PDFFont; bold: PDFFont },
  pageNumber: number,
  pageTotal: number
) {
  const border = rgb(0.16, 0.18, 0.22);
  const header = { x: 32, y: 721, width: 531, height: 101 };
  const logoCell = { x: 32, y: 721, width: 121, height: 101 };
  const logoMaxWidth = 64;
  const logoMaxHeight = 64;
  const logoScale = Math.min(logoMaxWidth / logo.width, logoMaxHeight / logo.height);
  const logoWidth = logo.width * logoScale;
  const logoHeight = logo.height * logoScale;

  page.drawRectangle({ ...header, borderColor: border, borderWidth: 0.85 });
  page.drawLine({ start: { x: 153, y: 721 }, end: { x: 153, y: 822 }, thickness: 0.65, color: border });
  page.drawLine({ start: { x: 454, y: 721 }, end: { x: 454, y: 822 }, thickness: 0.65, color: border });
  page.drawImage(logo, {
    x: logoCell.x + (logoCell.width - logoWidth) / 2,
    y: logoCell.y + (logoCell.height - logoHeight) / 2,
    width: logoWidth,
    height: logoHeight
  });
  drawCenteredText(page, "Certificado de Acreditación", 153, 779, 301, fonts.bold, 19);
  drawCenteredText(page, "de Competencias", 153, 751, 301, fonts.bold, 19);
  page.drawText("Código: F-OPE-068", { x: 466, y: 789, size: 8.8, font: fonts.regular, color: rgb(0.04, 0.05, 0.08) });
  page.drawText("Fecha: 01-08-2024", { x: 466, y: 766, size: 8.8, font: fonts.regular, color: rgb(0.04, 0.05, 0.08) });
  page.drawText("Version: 00", { x: 466, y: 743, size: 8.8, font: fonts.regular, color: rgb(0.04, 0.05, 0.08) });
  page.drawText(`Página: ${pageNumber} de ${pageTotal}`, { x: 466, y: 724, size: 8.8, font: fonts.regular, color: rgb(0.04, 0.05, 0.08) });
}

function drawCalendarIcon(page: PDFPage, x: number, y: number) {
  const red = rgb(0.82, 0.03, 0.07);
  page.drawRectangle({ x, y, width: 12, height: 12, borderColor: red, borderWidth: 1 });
  page.drawLine({ start: { x, y: y + 8 }, end: { x: x + 12, y: y + 8 }, thickness: 1, color: red });
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
  const tableX = 54;
  const tableWidth = 487;
  const headerHeight = 24;
  const rowHeight = 22;
  const columns = [88, 185, 214];
  const visibleRows = rows;
  const totalHeight = headerHeight + visibleRows.length * rowHeight;

  let x = tableX;
  ["Marca", "Tipo de equipo", "Modelo / configuración autorizada"].forEach((label, index) => {
    page.drawText(label, {
      x: x + 2,
      y: tableY - 14,
      size: 9,
      font: fonts.bold,
      color: rgb(0.07, 0.09, 0.16)
    });
    x += columns[index];
  });
  page.drawLine({
    start: { x: tableX, y: tableY - headerHeight },
    end: { x: tableX + tableWidth, y: tableY - headerHeight },
    thickness: 0.65,
    color: rgb(0.82, 0.84, 0.87)
  });

  for (let index = 0; index < visibleRows.length; index += 1) {
    const row = visibleRows[index];
    const y = tableY - headerHeight - (index + 1) * rowHeight;
    drawFittedText(page, row.brand_name, { x: tableX + 2, y: y + 7, width: columns[0] - 14, size: 9.5, font: fonts.regular });
    drawFittedText(page, row.type_name, { x: tableX + columns[0] + 2, y: y + 7, width: columns[1] - 14, size: 9.5, font: fonts.regular });
    drawFittedText(page, row.model_name, { x: tableX + columns[0] + columns[1] + 2, y: y + 7, width: columns[2] - 14, size: 9.5, font: fonts.regular });
  }

  return tableY - totalHeight;
}

function drawValidationPanel(page: PDFPage, input: {
  instructorName: string;
  instructorDocumentNumber: string;
  instructorProfileCode: string;
  folio: string;
  issuedDate: string;
  validUntil: string;
  validationBadge: Awaited<ReturnType<PDFDocument["embedPng"]>>;
}, qrPng: Awaited<ReturnType<PDFDocument["embedPng"]>>, fonts: { regular: PDFFont; bold: PDFFont; signature: PDFFont }) {
  const x = 54;
  const y = 108;
  const width = 487;
  const height = 154;
  const red = rgb(0.82, 0.03, 0.07);
  const lineColor = rgb(0.55, 0.59, 0.66);
  page.drawLine({ start: { x, y: y + height }, end: { x: x + width, y: y + height }, thickness: 0.7, color: lineColor });
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.7, color: lineColor });
  page.drawImage(input.validationBadge, { x: x + 14, y: y + height - 37, width: 18, height: 18 });
  page.drawText("VALIDACIÓN DEL CERTIFICADO", { x: x + 42, y: y + height - 28, size: 9.7, font: fonts.bold, color: rgb(0.07, 0.09, 0.16) });
  page.drawText("Verificación digital", { x: x + 332, y: y + height - 24, size: 9.2, font: fonts.bold, color: rgb(0.07, 0.09, 0.16) });
  page.drawText("Firmado electrónicamente por:", { x: x + 14, y: y + 94, size: 8.8, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  drawScaledText(page, input.instructorName, { x: x + 14, y: y + 59, width: 245, size: 23, minSize: 14, font: fonts.signature });
  page.drawLine({ start: { x: x + 14, y: y + 53 }, end: { x: x + 238, y: y + 53 }, thickness: 0.6, color: rgb(0.78, 0.81, 0.86) });
  page.drawText("Instructor de Conductores", { x: x + 14, y: y + 39, size: 8.6, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  page.drawText(`RUT N. ${input.instructorDocumentNumber}`, { x: x + 14, y: y + 23, size: 8.6, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  drawCalendarIcon(page, x + 14, y + 7);
  page.drawText(`Fecha de emisión: ${formatLongDate(input.issuedDate)}`, { x: x + 36, y: y + 8, size: 8.2, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  page.drawImage(qrPng, { x: x + 331, y: y + 51, width: 82, height: 82 });
  drawCenteredText(page, "Escanee el codigo QR para verificar", x + 295, y + 36, 170, fonts.regular, 8);
  drawCenteredText(page, "la autenticidad, estado y vigencia", x + 295, y + 23, 170, fonts.regular, 8);
  drawCenteredText(page, "de este certificado.", x + 295, y + 10, 170, fonts.regular, 8);

  const boxY = 42;
  const boxH = 50;
  const boxW = 487;
  const cellW = boxW / 4;
  page.drawLine({ start: { x, y: boxY + boxH }, end: { x: x + boxW, y: boxY + boxH }, thickness: 0.7, color: lineColor });
  page.drawLine({ start: { x, y: boxY }, end: { x: x + boxW, y: boxY }, thickness: 0.7, color: lineColor });
  const summary = [
    ["Código de certificado", input.folio],
    ["Código de perfil", input.instructorProfileCode],
    ["Emitido el", formatDate(input.issuedDate)],
    ["Vigente hasta", formatDate(input.validUntil)]
  ];
  summary.forEach((item, index) => {
    const cellX = x + cellW * index;
    drawCenteredText(page, item[0], cellX, boxY + 22, cellW, fonts.bold, 8.4);
    const valueFont = index === 3 ? fonts.bold : fonts.regular;
    const valueColor = index === 3 ? red : rgb(0.07, 0.09, 0.16);
    page.drawText(item[1], { x: cellX + (cellW - valueFont.widthOfTextAtSize(item[1], 8.2)) / 2, y: boxY + 8, size: 8.2, font: valueFont, color: valueColor });
  });
}

function drawEquipmentHeading(page: PDFPage, y: number, bold: PDFFont, busIcon: Awaited<ReturnType<PDFDocument["embedPng"]>>) {
  page.drawImage(busIcon, { x: 52, y: y - 20, width: 30, height: 30 });
  page.drawText("EQUIPOS AUTORIZADOS", { x: 94, y: y - 8, size: 11.2, font: bold, color: rgb(0.07, 0.09, 0.16) });
  page.drawLine({ start: { x: 258, y: y - 5 }, end: { x: 540, y: y - 5 }, thickness: 1, color: rgb(0.82, 0.03, 0.07) });
}

function drawCertificateFooter(page: PDFPage, regular: PDFFont, verificationUrl: string) {
  drawCenteredText(page, "Este certificado es válido únicamente con firma electrónica y puede ser verificado en:", 74, 24, 447, regular, 7.4);
  drawCenteredText(page, verificationUrl, 74, 13, 447, regular, 7.2);
  drawCenteredText(page, "También puede escanear el código QR del certificado.", 74, 3, 447, regular, 7.2);
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
  pdfDoc.registerFontkit(fontkit);
  const modelRows = authorizedModels.length > 0 ? authorizedModels : buildModelRowsFromSummary(request.model_summary);
  const pageTotal = calculateCertificatePageCount(modelRows.length);
  let pageNumber = 1;
  let page = pdfDoc.addPage([595.28, 841.89]);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const signatureFont = await pdfDoc.embedFont(dataUrlToBytes(CERTIFICATE_SIGNATURE_FONT_BASE64), { subset: true });
  const logo = await pdfDoc.embedPng(await readLogoBytes(workerCompanyName));
  const busIcon = await pdfDoc.embedPng(dataUrlToBytes(CERTIFICATE_BUS_ICON_BASE64));
  const validationBadge = await pdfDoc.embedPng(dataUrlToBytes(CERTIFICATE_VALIDATION_BADGE_BASE64));
  drawCertificateHeader(page, logo, { regular, bold }, pageNumber, pageTotal);

  const bodyX = 64;
  const bodyWidth = 467;
  let y = 674;
  y = drawRichParagraph(page, [
    { text: `Don ${instructor.full_name}, RUT N. ${instructor.document_number}, en su calidad de`, font: regular },
    { text: "Instructor de Conductores,", font: bold },
    { text: "certifica que don", font: regular },
    { text: `${request.worker_full_name}, RUT N. ${request.worker_document_number},`, font: bold },
    { text: "ha completado satisfactoriamente el proceso de capacitación, instrucción y evaluación teórico-práctica correspondiente a la conducción y operación de los equipos individualizados en el presente certificado.", font: regular }
  ], {
    x: bodyX,
    y,
    width: bodyWidth,
    size: 10.6,
    lineHeight: 16.6
  });
  y = drawRichParagraph(page, [
    { text: "De acuerdo con los procedimientos y estándares definidos por la empresa, el trabajador obtuvo una calificación final de 100 %, acreditando los conocimientos, habilidades y competencias requeridas para conducir y operar los equipos señalados en el cuadro de autorización.", font: regular }
  ], {
    x: bodyX,
    y,
    width: bodyWidth,
    size: 10.6,
    lineHeight: 16.6
  });
  y = drawRichParagraph(page, [
    { text: "En virtud de lo anterior, el trabajador queda", font: regular },
    { text: "HABILITADO", font: bold, color: rgb(0.82, 0.03, 0.07) },
    { text: `para conducir y operar los equipos individualizados en este certificado, con vigencia desde el ${formatLongDate(request.training_date)} hasta el ${formatLongDate(validUntil)}.`, font: regular }
  ], {
    x: bodyX,
    y,
    width: bodyWidth,
    size: 10.6,
    lineHeight: 16.6
  });

  const verificationUrl = buildVerificationUrl(certificate.verification_token);
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: {
      dark: "#000000",
      light: "#ffffff"
    }
  });
  const qrPng = await pdfDoc.embedPng(dataUrlToBytes(qrDataUrl));
  const firstPageRows = modelRows.slice(0, FIRST_PAGE_MODEL_CAPACITY);
  let remainingRows = modelRows.slice(FIRST_PAGE_MODEL_CAPACITY);
  const sectionY = 430;
  drawEquipmentHeading(page, sectionY, bold, busIcon);
  drawModelSummary(page, firstPageRows, { regular, bold }, sectionY - 22);

  const drawFinalBlocks = () => {
    drawValidationPanel(page, {
      instructorName: instructor.signature_label || instructor.full_name,
      instructorDocumentNumber: instructor.document_number,
      instructorProfileCode: instructor.profile_code,
      folio: certificate.folio,
      issuedDate,
      validUntil,
      validationBadge
    }, qrPng, { regular, bold, signature: signatureFont });
    drawCertificateFooter(page, regular, verificationUrl);
  };

  if (remainingRows.length === 0) {
    drawFinalBlocks();
  } else {
    while (remainingRows.length > LAST_PAGE_MODEL_CAPACITY) {
      pageNumber += 1;
      page = pdfDoc.addPage([595.28, 841.89]);
      drawCertificateHeader(page, logo, { regular, bold }, pageNumber, pageTotal);
      drawEquipmentHeading(page, 650, bold, busIcon);
      drawModelSummary(page, remainingRows.slice(0, CONTINUATION_PAGE_MODEL_CAPACITY), { regular, bold }, 628);
      remainingRows = remainingRows.slice(CONTINUATION_PAGE_MODEL_CAPACITY);
    }

    pageNumber += 1;
    page = pdfDoc.addPage([595.28, 841.89]);
    drawCertificateHeader(page, logo, { regular, bold }, pageNumber, pageTotal);
    drawEquipmentHeading(page, 650, bold, busIcon);
    drawModelSummary(page, remainingRows, { regular, bold }, 628);
    drawFinalBlocks();
  }

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
      await refreshPublicValidationSnapshot(supabase, certificateRow.id);

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

    const workerCompanyName = await resolveWorkerCompanyName(supabase, employeeCompanyRow);
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

    await refreshPublicValidationSnapshot(supabase, certificateRow.id);

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
