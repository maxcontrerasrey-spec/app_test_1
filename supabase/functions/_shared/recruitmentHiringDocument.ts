import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";
import {
  CERTIFICATE_SIGNATURE_FONT_BASE64,
  CERTIFICATE_VALIDATION_BADGE_BASE64,
  CONSORCIO_ANDINO_LOGO_BASE64,
  CONSORCIO_NUEVO_NORTE_LOGO_BASE64,
  JM_LOGO_BASE64
} from "../generate-competency-certificate/logos.ts";

const DEFAULT_PUBLIC_APP_BASE_URL = "https://gestion.busesjm.cl";
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const RED = rgb(0.82, 0.03, 0.07);
const INK = rgb(0.07, 0.09, 0.16);
const MUTED = rgb(0.48, 0.52, 0.58);
const LINE = rgb(0.78, 0.81, 0.86);
const LINE_STRONG = rgb(0.55, 0.59, 0.66);
const SOFT = rgb(0.96, 0.97, 0.98);

type JsonRecord = Record<string, unknown>;

export type RecruitmentHiringDocumentRow = {
  id: string;
  buk_sync_job_id: string;
  folio: string;
  verification_token: string;
  template_code: string;
  template_version: string;
  template_date: string;
  generation_status: string;
  source_snapshot: JsonRecord;
  source_snapshot_sha256: string;
  pdf_file_name: string | null;
  pdf_sha256: string | null;
  pdf_size_bytes: number | null;
  issued_at: string | null;
  validated_by: string;
  validated_at: string;
  buk_employee_id: string | null;
  buk_folder_name: string;
  buk_folder_id: string | null;
  buk_document_id: string | null;
  buk_document_url: string | null;
  buk_document_name: string | null;
  buk_upload_status: string;
  buk_upload_attempts: number;
  buk_upload_started_at: string | null;
  buk_uploaded_at: string | null;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asText(value: unknown, fallback = "No informado") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveLogoBase64(companyName: string) {
  const normalized = normalizeText(companyName);
  if (normalized.includes("consorcio andino")) return CONSORCIO_ANDINO_LOGO_BASE64;
  if (normalized.includes("consorcio nuevo norte")) return CONSORCIO_NUEVO_NORTE_LOGO_BASE64;
  return JM_LOGO_BASE64;
}

function buildPublicBaseUrl() {
  return (
    Deno.env.get("PUBLIC_APP_URL") ??
    Deno.env.get("APP_PUBLIC_URL") ??
    DEFAULT_PUBLIC_APP_BASE_URL
  ).trim().replace(/\/+$/, "");
}

export function buildRecruitmentHiringVerificationUrl(token: string) {
  return `${buildPublicBaseUrl()}/verificar/documento/${encodeURIComponent(token)}`;
}

function formatDate(value: unknown) {
  const text = asNullableText(value);
  if (!text) return "No informado";
  const match = text.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
}

function formatDateTime(value: unknown) {
  const text = asNullableText(value);
  if (!text) return "No informado";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return formatDate(text);
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date).replace(",", "");
}

function formatRut(value: unknown) {
  const normalized = asText(value, "").replace(/[^0-9Kk]/g, "").toUpperCase();
  if (normalized.length < 2) return asText(value);
  const body = normalized.slice(0, -1);
  const verifier = normalized.slice(-1);
  return `${Number(body).toLocaleString("es-CL")}-${verifier}`;
}

function maskDocumentNumber(value: unknown) {
  const normalized = asText(value, "").replace(/[^0-9Kk]/g, "").toUpperCase();
  if (normalized.length < 4) return "***";
  return `***.***.${normalized.slice(-4)}`;
}

function formatClp(value: unknown) {
  const amount = asNumber(value);
  return amount == null ? "No informado" : `$${Math.round(amount).toLocaleString("es-CL")}`;
}

function fitText(font: PDFFont, text: string, maxWidth: number, preferred: number, minimum = 6) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.25;
  return size;
}

function centeredText(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number, color = INK) {
  const fitted = fitText(font, text, width, size);
  page.drawText(text, {
    x: x + Math.max(0, (width - font.widthOfTextAtSize(text, fitted)) / 2),
    y,
    size: fitted,
    font,
    color
  });
}

function drawHeader(page: PDFPage, logo: Awaited<ReturnType<PDFDocument["embedPng"]>>, regular: PDFFont, bold: PDFFont) {
  const maxLogoWidth = 62;
  const maxLogoHeight = 62;
  const scale = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
  const logoWidth = logo.width * scale;
  const logoHeight = logo.height * scale;
  page.drawImage(logo, {
    x: 76 + (maxLogoWidth - logoWidth) / 2,
    y: 748 + (maxLogoHeight - logoHeight) / 2,
    width: logoWidth,
    height: logoHeight
  });
  centeredText(page, "Solicitud de Contratación", 165, 773, 280, bold, 19.5);
  const metadata = [
    ["Código:", "F-RH-010"],
    ["Fecha:", "12-03-18"],
    ["Versión:", "1"],
    ["Página:", "1 de 1"]
  ];
  metadata.forEach(([label, value], index) => {
    const y = 797 - index * 19;
    page.drawText(label, { x: 457, y, size: 8.2, font: bold, color: MUTED });
    page.drawText(value, { x: 499, y, size: 8.2, font: regular, color: MUTED });
  });
  page.drawLine({ start: { x: 54, y: 726 }, end: { x: 541, y: 726 }, thickness: 1.5, color: RED });
}

function drawSectionLabel(page: PDFPage, text: string, y: number, bold: PDFFont) {
  page.drawText(text.toUpperCase(), { x: 54, y, size: 7.2, font: bold, color: RED });
}

function drawDetailTable(page: PDFPage, rows: Array<[string, string]>, regular: PDFFont, bold: PDFFont) {
  const x = 54;
  const width = 487;
  const labelWidth = 150;
  const rowHeight = 20;
  let y = 695;
  rows.forEach(([label, value], index) => {
    const rowY = y - rowHeight;
    page.drawRectangle({ x, y: rowY, width: labelWidth, height: rowHeight, color: SOFT });
    page.drawRectangle({ x, y: rowY, width, height: rowHeight, borderColor: LINE, borderWidth: 0.65 });
    page.drawLine({ start: { x: x + labelWidth, y: rowY }, end: { x: x + labelWidth, y }, thickness: 0.65, color: LINE });
    page.drawText(label, { x: x + 6, y: rowY + 6.2, size: 7.8, font: bold, color: INK });
    const valueSize = fitText(bold, value, width - labelWidth - 12, 7.8, 6.2);
    page.drawText(value, { x: x + labelWidth + 8, y: rowY + 6.2, size: valueSize, font: bold, color: INK });
    y = rowY;
    if (index === rows.length - 1) {
      page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.65, color: LINE_STRONG });
    }
  });
}

function drawDocuments(page: PDFPage, documents: Array<{ name: string; uploaded: boolean }>, regular: PDFFont, bold: PDFFont) {
  const x = 54;
  const width = 487;
  const itemWidth = 34;
  const statusWidth = 43;
  const nameWidth = width - itemWidth - statusWidth * 2;
  const captionY = 467;
  const captionHeight = 17;
  const headerHeight = 16;
  const rowHeight = 12.2;
  page.drawRectangle({ x, y: captionY - captionHeight, width, height: captionHeight, color: SOFT, borderColor: LINE_STRONG, borderWidth: 0.75 });
  centeredText(page, "Documentación Adjunta", x, captionY - 12, width, bold, 8.4);
  const headerY = captionY - captionHeight - headerHeight;
  page.drawRectangle({ x, y: headerY, width, height: headerHeight, color: SOFT, borderColor: LINE_STRONG, borderWidth: 0.75 });
  const boundaries = [x, x + itemWidth, x + itemWidth + nameWidth, x + itemWidth + nameWidth + statusWidth, x + width];
  boundaries.slice(1, -1).forEach((boundary) => {
    page.drawLine({ start: { x: boundary, y: headerY }, end: { x: boundary, y: headerY + headerHeight }, thickness: 0.55, color: LINE });
  });
  centeredText(page, "ÍTEM", boundaries[0], headerY + 5.2, itemWidth, bold, 6.4, MUTED);
  centeredText(page, "DOCUMENTO ENTREGADO", boundaries[1], headerY + 5.2, nameWidth, bold, 6.4, MUTED);
  centeredText(page, "SÍ", boundaries[2], headerY + 5.2, statusWidth, bold, 6.4, MUTED);
  centeredText(page, "N/A", boundaries[3], headerY + 5.2, statusWidth, bold, 6.4, MUTED);

  documents.slice(0, 17).forEach((document, index) => {
    const rowY = headerY - (index + 1) * rowHeight;
    page.drawRectangle({ x, y: rowY, width, height: rowHeight, borderColor: LINE, borderWidth: 0.45 });
    boundaries.slice(1, -1).forEach((boundary) => {
      page.drawLine({ start: { x: boundary, y: rowY }, end: { x: boundary, y: rowY + rowHeight }, thickness: 0.45, color: LINE });
    });
    centeredText(page, String(index + 1), boundaries[0], rowY + 3.7, itemWidth, regular, 6.3);
    const documentSize = fitText(regular, document.name, nameWidth - 8, 6.5, 5.4);
    page.drawText(document.name, { x: boundaries[1] + 4, y: rowY + 3.7, size: documentSize, font: regular, color: INK });
    centeredText(
      page,
      document.uploaded ? "SÍ" : "N/A",
      document.uploaded ? boundaries[2] : boundaries[3],
      rowY + 3.7,
      statusWidth,
      bold,
      6.2,
      document.uploaded ? rgb(0.09, 0.46, 0.29) : MUTED
    );
  });
}

function drawValidation(page: PDFPage, input: {
  signerName: string;
  signerTitle: string;
  validatedAt: string;
  folio: string;
  issuedAt: string;
}, badge: Awaited<ReturnType<PDFDocument["embedPng"]>>, qr: Awaited<ReturnType<PDFDocument["embedPng"]>>, fonts: { regular: PDFFont; bold: PDFFont; signature: PDFFont }) {
  const x = 72;
  const y = 56;
  const width = 451;
  const height = 122;
  page.drawLine({ start: { x, y: y + height }, end: { x: x + width, y: y + height }, thickness: 0.8, color: LINE_STRONG });
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.8, color: LINE_STRONG });
  page.drawLine({ start: { x, y }, end: { x, y: y + height }, thickness: 2.6, color: RED });
  page.drawImage(badge, { x: x + 13, y: y + 40, width: 54, height: 54 });
  page.drawText("VALIDACIÓN DOCUMENTAL ERP", { x: x + 82, y: y + 94, size: 8.7, font: fonts.bold, color: INK });
  page.drawText(`Firmado electrónicamente el ${input.validatedAt} por:`, { x: x + 82, y: y + 78, size: 6.8, font: fonts.regular, color: MUTED });
  const signatureSize = fitText(fonts.signature, input.signerName, 230, 21, 13);
  page.drawText(input.signerName, { x: x + 82, y: y + 49, size: signatureSize, font: fonts.signature, color: INK });
  page.drawLine({ start: { x: x + 82, y: y + 45 }, end: { x: x + 312, y: y + 45 }, thickness: 0.55, color: LINE_STRONG });
  page.drawText(input.signerName, { x: x + 82, y: y + 33, size: 6.7, font: fonts.bold, color: INK });
  page.drawText(input.signerTitle, { x: x + 82, y: y + 21, size: 6.3, font: fonts.regular, color: MUTED });
  page.drawImage(qr, { x: x + 357, y: y + 35, width: 64, height: 64 });
  centeredText(page, "Verificar autenticidad", x + 347, y + 23, 84, fonts.regular, 5.3, MUTED);

  const summaryY = y - 28;
  const summary = [
    ["SOLICITUD", input.folio],
    ["FORMATO", "F-RH-010 · V1"],
    ["EMITIDO EL", input.issuedAt]
  ];
  const cellWidth = width / summary.length;
  summary.forEach(([label, value], index) => {
    const cellX = x + index * cellWidth;
    page.drawRectangle({ x: cellX, y: summaryY, width: cellWidth, height: 28, borderColor: LINE, borderWidth: 0.45 });
    page.drawText(label, { x: cellX + 6, y: summaryY + 17, size: 5.1, font: fonts.bold, color: MUTED });
    page.drawText(value, { x: cellX + 6, y: summaryY + 6, size: fitText(fonts.bold, value, cellWidth - 12, 6.3, 5.2), font: fonts.bold, color: INK });
  });
}

export async function buildRecruitmentHiringDocumentPdf(row: RecruitmentHiringDocumentRow) {
  const source = asRecord(row.source_snapshot);
  const document = asRecord(source.document);
  const requester = asRecord(source.requester);
  const worker = asRecord(source.worker);
  const employment = asRecord(source.employment);
  const validation = asRecord(source.validation);
  const documents = Array.isArray(source.documents)
    ? source.documents.map((item) => {
      const record = asRecord(item);
      return { name: asText(record.name), uploaded: record.uploaded === true };
    })
    : [];
  const companyName = asText(employment.company_name, "Buses JM");
  const issuedAt = asText(document.ready_for_hire_at);
  const verificationUrl = buildRecruitmentHiringVerificationUrl(row.verification_token);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fixedDate = new Date(issuedAt);
  if (!Number.isNaN(fixedDate.getTime())) {
    pdf.setCreationDate(fixedDate);
    pdf.setModificationDate(fixedDate);
  }
  pdf.setTitle(`Solicitud de Contratación ${row.folio}`);
  pdf.setSubject("Solicitud de Contratación generada por el ERP");
  pdf.setProducer("ERP Buses JM");
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const signature = await pdf.embedFont(dataUrlToBytes(CERTIFICATE_SIGNATURE_FONT_BASE64), { subset: true });
  const logo = await pdf.embedPng(dataUrlToBytes(resolveLogoBase64(companyName)));
  const badge = await pdf.embedPng(dataUrlToBytes(CERTIFICATE_VALIDATION_BADGE_BASE64));
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: { dark: "#000000", light: "#ffffff" }
  });
  const qr = await pdf.embedPng(dataUrlToBytes(qrDataUrl));

  drawHeader(page, logo, regular, bold);
  drawSectionLabel(page, "Antecedentes de la contratación", 710, bold);
  drawDetailTable(page, [
    ["Fecha", formatDate(document.ready_for_hire_at)],
    ["Nombre solicitante", asText(requester.full_name)],
    ["Cargo del solicitante", asText(requester.job_title)],
    ["Nombre nuevo trabajador", asText(worker.full_name)],
    ["RUN nuevo trabajador", formatRut(worker.document_number)],
    ["Cargo nuevo trabajador", asText(worker.job_title)],
    ["Nombre de contrato", asText(employment.contract_name)],
    ["Jornada (turno)", asText(employment.shift_name)],
    ["Fecha de ingreso", formatDate(employment.entry_date)],
    ["Sueldo líquido pactado", formatClp(employment.net_salary)]
  ], regular, bold);
  drawSectionLabel(page, "Respaldo documental del candidato", 481, bold);
  drawDocuments(page, documents, regular, bold);
  drawValidation(page, {
    signerName: asText(validation.full_name),
    signerTitle: asText(validation.job_title),
    validatedAt: formatDateTime(validation.validated_at),
    folio: row.folio,
    issuedAt: formatDate(issuedAt)
  }, badge, qr, { regular, bold, signature });
  centeredText(page, "Documento válido únicamente con firma electrónica ERP y código de verificación.", 54, 8, 487, regular, 5.5, MUTED);

  return pdf.save();
}

export function buildRecruitmentHiringPublicSnapshot(row: RecruitmentHiringDocumentRow, issuedAt: string, pdfHash: string) {
  const source = asRecord(row.source_snapshot);
  const worker = asRecord(source.worker);
  const employment = asRecord(source.employment);
  const validation = asRecord(source.validation);
  return {
    schema_version: 1,
    document_kind: "hiring_request",
    document: {
      folio: row.folio,
      template_code: row.template_code,
      template_version: row.template_version,
      issued_at: issuedAt,
      pdf_sha256: pdfHash
    },
    worker: {
      full_name: asText(worker.full_name),
      document_number_masked: maskDocumentNumber(worker.document_number),
      job_title: asText(worker.job_title)
    },
    employment: {
      company_name: asText(employment.company_name),
      contract_name: asText(employment.contract_name),
      job_title: asText(worker.job_title)
    },
    validation: {
      full_name: asText(validation.full_name),
      job_title: asText(validation.job_title),
      validated_at: asText(validation.validated_at)
    }
  };
}
