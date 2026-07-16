import {
  asArray,
  asRecord,
  getSupabaseClientOrThrow as getSupabaseClient,
  getSupabaseErrorMessage,
  readBoolean,
  readNullableText,
  readNumber,
  readText
} from "../../../shared/lib/supabaseRpc";
import { buildPublicAppUrl } from "../../../shared/config/runtime";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import certificateBusIconUrl from "../assets/certificate-bus-icon.png";
import certificateValidationBadgeUrl from "../assets/certificate-validation-badge.png";
import certificateSignatureFontUrl from "../assets/fonts/DancingScript-Regular.ttf";
import consorcioAndinoLogoUrl from "../assets/consorcio-andino.png";
import consorcioNuevoNorteLogoUrl from "../assets/consorcio-nuevo-norte.png";
import jmLogoUrl from "../assets/jm.png";
import type {
  CompetencyCatalogOption,
  CompetencyCatalogs,
  CompetencyDashboardPayload,
  CompetencyDashboardRow,
  CompetencyEquipmentModel,
  CompetencyEvaluationUpload,
  CompetencyGenerationResult,
  CompetencyInstructor,
  CompetencyPreviewPdfInput,
  CompetencyPreviewPdfResult,
  CompetencyPublicVerification,
  CompetencyRequestInput,
  CompetencyRequestResult,
  CompetencyWorker
} from "../types";

const COMPETENCY_BUCKET = "competency_documents";
const MAX_EVALUATION_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EVALUATION_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function mapCatalogOption(item: Record<string, unknown>): CompetencyCatalogOption {
  return {
    id: readText(item.id),
    code: readText(item.code),
    name: readText(item.name),
    sortOrder: readNumber(item.sort_order)
  };
}

function mapEquipmentModel(item: Record<string, unknown>): CompetencyEquipmentModel {
  return {
    ...mapCatalogOption(item),
    brandId: readText(item.brand_id),
    typeId: readText(item.type_id),
    brandName: readText(item.brand_name),
    typeName: readText(item.type_name)
  };
}

function mapInstructor(item: Record<string, unknown>): CompetencyInstructor {
  return {
    id: readText(item.id),
    userId: readNullableText(item.user_id),
    fullName: readText(item.full_name),
    documentNumber: readText(item.document_number),
    profileCode: readText(item.profile_code),
    signatureLabel: readNullableText(item.signature_label),
    status: readText(item.status)
  };
}

function mapCatalogs(payload: unknown): CompetencyCatalogs {
  const source = asRecord(payload);
  const permissions = asRecord(source.permissions);

  return {
    brands: asArray<Record<string, unknown>>(source.brands).map(mapCatalogOption),
    types: asArray<Record<string, unknown>>(source.types).map(mapCatalogOption),
    models: asArray<Record<string, unknown>>(source.models).map(mapEquipmentModel),
    instructors: asArray<Record<string, unknown>>(source.instructors).map(mapInstructor),
    permissions: {
      canAdmin: readBoolean(permissions.can_admin),
      canAccess: readBoolean(permissions.can_access)
    }
  };
}

function mapWorker(item: Record<string, unknown>): CompetencyWorker {
  return {
    bukEmployeeId: readText(item.buk_employee_id),
    fullName: readText(item.full_name),
    documentNumber: readNullableText(item.document_number) ?? "",
    documentType: readText(item.document_type),
    jobTitle: readNullableText(item.job_title),
    areaName: readNullableText(item.area_name),
    contractCode: readNullableText(item.contract_code),
    companyName: readNullableText(item.company_name),
    displayLabel: readText(item.display_label)
  };
}

function mapRequestResult(payload: unknown): CompetencyRequestResult {
  const source = asRecord(payload);
  return {
    requestId: readText(source.request_id),
    certificateId: readText(source.certificate_id),
    folio: readText(source.folio),
    verificationToken: readText(source.verification_token)
  };
}

function mapGenerationResult(payload: unknown): CompetencyGenerationResult {
  const source = asRecord(payload);
  return {
    success: readBoolean(source.success),
    alreadyGenerated: source.alreadyGenerated === undefined ? undefined : readBoolean(source.alreadyGenerated),
    folio: readText(source.folio),
    verificationToken: readNullableText(source.verificationToken) ?? undefined,
    pdfPath: readText(source.pdfPath),
    pdfHash: readNullableText(source.pdfHash) ?? undefined,
    bukUploadStatus: readText(source.bukUploadStatus),
    bukDocumentId: readNullableText(source.bukDocumentId),
    bukDocumentUrl: readNullableText(source.bukDocumentUrl),
    bukError: readNullableText(source.bukError)
  };
}

function mapDashboardRow(item: Record<string, unknown>): CompetencyDashboardRow {
  return {
    requestId: readText(item.request_id),
    certificateId: readText(item.certificate_id),
    folio: readText(item.folio),
    workerFullName: readText(item.worker_full_name),
    workerDocumentNumber: readText(item.worker_document_number),
    workerJobTitle: readNullableText(item.worker_job_title),
    workerAreaName: readNullableText(item.worker_area_name),
    workerContractCode: readNullableText(item.worker_contract_code),
    instructorFullName: readText(item.instructor_full_name),
    modelSummary: readText(item.model_summary),
    trainingDate: readText(item.training_date),
    requestStatus: readText(item.request_status),
    certificateStatus: readText(item.certificate_status),
    competencyStatus: readText(item.competency_status),
    bukUploadStatus: readText(item.buk_upload_status),
    validUntil: readNullableText(item.valid_until),
    pdfPath: readNullableText(item.pdf_path),
    createdAt: readText(item.created_at)
  };
}

function mapDashboard(payload: unknown): CompetencyDashboardPayload {
  const source = asRecord(payload);
  const summary = asRecord(source.summary);
  return {
    summary: {
      total: readNumber(summary.total),
      enabled: readNumber(summary.enabled),
      pendingBuk: readNumber(summary.pending_buk),
      expired: readNumber(summary.expired)
    },
    recent: asArray<Record<string, unknown>>(source.recent).map(mapDashboardRow)
  };
}

function mapPublicVerification(payload: unknown): CompetencyPublicVerification {
  const source = asRecord(payload);
  const certificate = asRecord(source.certificate);
  const worker = asRecord(source.worker);
  const instructor = asRecord(source.instructor);
  const training = asRecord(source.training);

  return {
    found: readBoolean(source.found),
    isAuthentic: readBoolean(source.is_authentic),
    isCurrent: readBoolean(source.is_current),
    status: readText(source.status),
    verifiedAt: readNullableText(source.verified_at),
    snapshotUpdatedAt: readNullableText(source.snapshot_updated_at),
    certificate: {
      folio: readText(certificate.folio),
      templateCode: readText(certificate.template_code),
      templateVersion: readText(certificate.template_version),
      certificateStatus: readText(certificate.certificate_status),
      competencyStatus: readText(certificate.competency_status),
      issuedAt: readNullableText(certificate.issued_at),
      validFrom: readNullableText(certificate.valid_from),
      validUntil: readNullableText(certificate.valid_until),
      pdfSha256: readNullableText(certificate.pdf_sha256),
      bukRegistered: readBoolean(certificate.buk_registered),
      bukUploadedAt: readNullableText(certificate.buk_uploaded_at)
    },
    worker: {
      fullName: readText(worker.full_name),
      documentNumber: readText(worker.document_number),
      jobTitle: readNullableText(worker.job_title)
    },
    instructor: {
      fullName: readText(instructor.full_name),
      documentNumber: readText(instructor.document_number),
      profileCode: readText(instructor.profile_code)
    },
    training: {
      trainingDate: readNullableText(training.training_date)
    },
    equipment: asArray<Record<string, unknown>>(source.equipment).map((item) => ({
      brandName: readText(item.brand_name),
      typeName: readText(item.type_name),
      modelName: readText(item.model_name)
    }))
  };
}

async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeFileName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "evaluacion";
}

function buildPreviewVerificationUrl(folio: string) {
  return buildPublicAppUrl(`/verificar/competencia/${encodeURIComponent(folio)}`) ??
    `/verificar/competencia/${encodeURIComponent(folio)}`;
}

export async function fetchCompetencyCatalogs() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_competency_catalogs");

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar los catalogos de competencias.", "message"));
  }

  return mapCatalogs(data);
}

export async function searchCompetencyWorkers(searchText: string, limit = 20) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("search_competency_workers", {
    search_text: searchText,
    result_limit: limit
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible buscar trabajadores BUK.", "message"));
  }

  return asArray<Record<string, unknown>>(data).map(mapWorker);
}

export async function fetchCompetencyDashboard() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_competency_dashboard");

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar el resumen de competencias.", "message"));
  }

  return mapDashboard(data);
}

export async function verifyCompetencyCertificate(lookupText: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke("verify-competency-certificate", {
    body: {
      lookup: lookupText.trim()
    }
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible validar el certificado.", "message"));
  }

  return mapPublicVerification(data);
}

export async function uploadCompetencyEvaluationFile(file: File, userId: string): Promise<CompetencyEvaluationUpload> {
  if (!ALLOWED_EVALUATION_MIME_TYPES.has(file.type)) {
    throw new Error("Solo se permiten evaluaciones en PDF, JPG o PNG.");
  }

  if (file.size <= 0 || file.size > MAX_EVALUATION_SIZE_BYTES) {
    throw new Error("El archivo de evaluacion debe pesar entre 1 byte y 15 MB.");
  }

  const client = getSupabaseClient();
  const sha256 = await sha256Hex(file);
  const safeName = sanitizeFileName(file.name);
  const path = `evaluations/${userId}/${Date.now()}-${safeName}`;
  const { error } = await client.storage.from(COMPETENCY_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar la evaluacion.", "message"));
  }

  return {
    path,
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    sha256
  };
}

export async function createCompetencyRequest(input: CompetencyRequestInput) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("create_competency_request", {
    request_payload: {
      workerBukEmployeeId: input.workerBukEmployeeId,
      instructorId: input.instructorId,
      modelIds: input.modelIds,
      trainingDate: input.trainingDate,
      trainingStartTime: input.trainingStartTime,
      trainingEndTime: input.trainingEndTime,
      trainingLocation: input.trainingLocation,
      theoreticalScore: input.theoreticalScore,
      practicalScore: input.practicalScore,
      finalScore: input.finalScore,
      evaluationDate: input.evaluationDate,
      evaluationFilePath: input.evaluationFilePath,
      evaluationFileName: input.evaluationFileName,
      evaluationMimeType: input.evaluationMimeType,
      evaluationSizeBytes: input.evaluationSizeBytes,
      evaluationSha256: input.evaluationSha256,
      declarationAccepted: input.declarationAccepted
    }
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible crear la solicitud de competencia.", "message"));
  }

  return mapRequestResult(data);
}

export async function generateCompetencyCertificate(requestId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke("generate-competency-certificate", {
    body: { requestId }
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible generar el certificado.", "message"));
  }

  const payload = asRecord(data);
  if (payload.error) {
    throw new Error(readText(payload.error) || "No fue posible generar el certificado.");
  }

  return mapGenerationResult(payload);
}

export async function createCompetencyDocumentUrl(path: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.storage.from(COMPETENCY_BUCKET).createSignedUrl(path, 60);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible preparar la descarga.", "message"));
  }

  return data.signedUrl;
}

function formatPreviewDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return [day, month, year].filter(Boolean).join("-");
}

function addYears(dateValue: string, years: number) {
  const source = new Date(`${dateValue || new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  source.setUTCFullYear(source.getUTCFullYear() + years);
  return source.toISOString().slice(0, 10);
}

function resolveLogoUrl(companyName: string | null | undefined) {
  const normalized = (companyName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("consorcio andino")) {
    return consorcioAndinoLogoUrl;
  }

  if (normalized.includes("consorcio nuevo norte")) {
    return consorcioNuevoNorteLogoUrl;
  }

  return jmLogoUrl;
}

async function fetchBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("No fue posible cargar el logo del certificado.");
  }

  return new Uint8Array(await response.arrayBuffer());
}

function dataUrlToBytes(dataUrl: string) {
  const dataUrlParts = dataUrl.split(",");
  const base64 = dataUrl.includes(",") ? dataUrlParts[dataUrlParts.length - 1] ?? "" : dataUrl;
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function renderQrImage(verificationUrl: string) {
  const dataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: {
      dark: "#000000",
      light: "#ffffff"
    }
  });

  return dataUrlToBytes(dataUrl);
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

  if (current) lines.push(current);
  return lines;
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size: number,
  color = rgb(0.09, 0.09, 0.11)
) {
  page.drawText(text, {
    x: x + (width - font.widthOfTextAtSize(text, size)) / 2,
    y,
    size,
    font,
    color
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
    page.drawText(line, {
      x: options.x,
      y: options.y,
      size: options.size,
      font: options.font,
      color: rgb(0.12, 0.12, 0.14)
    });
    return;
  }

  const wordsWidth = words.reduce((total, word) => total + options.font.widthOfTextAtSize(word, options.size), 0);
  const gap = (options.width - wordsWidth) / (words.length - 1);

  if (!Number.isFinite(gap) || gap < 2 || gap > 9) {
    page.drawText(line, {
      x: options.x,
      y: options.y,
      size: options.size,
      font: options.font,
      color: rgb(0.12, 0.12, 0.14)
    });
    return;
  }

  let cursorX = options.x;
  for (const word of words) {
    page.drawText(word, {
      x: cursorX,
      y: options.y,
      size: options.size,
      font: options.font,
      color: rgb(0.12, 0.12, 0.14)
    });
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

function formatLongPreviewDate(value: string) {
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
  const watermark = rgb(0.48, 0.52, 0.58);
  const header = { x: 32, y: 721, width: 531, height: 101 };
  const logoCell = { x: 32, y: 721, width: 121, height: 101 };
  const metadataCell = { x: 454, y: 721, width: 109, height: 101 };
  const logoMaxWidth = 64;
  const logoMaxHeight = 64;
  const logoScale = Math.min(logoMaxWidth / logo.width, logoMaxHeight / logo.height);
  const logoWidth = logo.width * logoScale;
  const logoHeight = logo.height * logoScale;

  page.drawLine({ start: { x: header.x, y: header.y + header.height }, end: { x: metadataCell.x, y: header.y + header.height }, thickness: 0.85, color: border });
  page.drawLine({ start: { x: header.x, y: header.y }, end: { x: header.x + header.width, y: header.y }, thickness: 0.85, color: border });
  page.drawLine({ start: { x: header.x, y: header.y }, end: { x: header.x, y: header.y + header.height }, thickness: 0.85, color: border });
  page.drawLine({ start: { x: 153, y: 721 }, end: { x: 153, y: 822 }, thickness: 0.65, color: border });
  page.drawImage(logo, {
    x: logoCell.x + (logoCell.width - logoWidth) / 2,
    y: logoCell.y + (logoCell.height - logoHeight) / 2,
    width: logoWidth,
    height: logoHeight
  });
  drawCenteredText(page, "Certificado de Acreditación", 153, 779, 301, fonts.bold, 19);
  drawCenteredText(page, "de Competencias", 153, 751, 301, fonts.bold, 19);
  const metadataRows: Array<[string, number]> = [
    ["Código: F-OPE-068", 786],
    ["Fecha: 01-08-2024", 764],
    ["Version: 00", 742],
    [`Página: ${pageNumber} de ${pageTotal}`, 724]
  ];
  metadataRows.forEach(([label, textY]) => {
    drawCenteredText(page, label, metadataCell.x + 7, textY, metadataCell.width - 14, fonts.regular, 8.1, watermark);
  });
}

function drawCalendarIcon(page: PDFPage, x: number, y: number) {
  const red = rgb(0.82, 0.03, 0.07);
  page.drawRectangle({ x, y, width: 12, height: 12, borderColor: red, borderWidth: 1 });
  page.drawLine({ start: { x, y: y + 8 }, end: { x: x + 12, y: y + 8 }, thickness: 1, color: red });
}

function drawModelSummary(page: PDFPage, rows: CompetencyPreviewPdfInput["authorizedModels"], fonts: { regular: PDFFont; bold: PDFFont }, tableY: number) {
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
    drawFittedText(page, row.brandName, {
      x: tableX + 2,
      y: y + 7,
      width: columns[0] - 14,
      size: 9.5,
      font: fonts.regular
    });
    drawFittedText(page, row.typeName, {
      x: tableX + columns[0] + 2,
      y: y + 7,
      width: columns[1] - 14,
      size: 9.5,
      font: fonts.regular
    });
    drawFittedText(page, row.modelName, {
      x: tableX + columns[0] + columns[1] + 2,
      y: y + 7,
      width: columns[2] - 14,
      size: 9.5,
      font: fonts.regular
    });
  }

  return tableY - totalHeight;
}

async function renderSignatureImage(name: string) {
  const fontFace = new FontFace("CertificateSignature", `url(${certificateSignatureFontUrl})`);
  const loadedFont = await fontFace.load();
  document.fonts.add(loadedFont);

  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 180;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No fue posible preparar la firma del certificado.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#111827";
  let fontSize = 86;
  do {
    context.font = `${fontSize}px CertificateSignature`;
    fontSize -= 2;
  } while (fontSize > 50 && context.measureText(name).width > 820);

  context.fillText(name, 28, 116);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("No fue posible renderizar la firma del certificado."));
      }
    }, "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
}

function drawValidationPanel(page: PDFPage, input: CompetencyPreviewPdfInput, fonts: { regular: PDFFont; bold: PDFFont }, options: {
  folio: string;
  issuedDate: string;
  validUntil: string;
  validationBadge: Awaited<ReturnType<PDFDocument["embedPng"]>>;
  signatureImage: Awaited<ReturnType<PDFDocument["embedPng"]>>;
  qrImage: Awaited<ReturnType<PDFDocument["embedPng"]>>;
}) {
  const x = 54;
  const y = 108;
  const width = 487;
  const height = 154;
  const red = rgb(0.82, 0.03, 0.07);
  const lineColor = rgb(0.55, 0.59, 0.66);
  page.drawLine({ start: { x, y: y + height }, end: { x: x + width, y: y + height }, thickness: 0.7, color: lineColor });
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.7, color: lineColor });
  page.drawImage(options.validationBadge, { x: x + 14, y: y + height - 37, width: 18, height: 18 });
  page.drawText("VALIDACIÓN DEL CERTIFICADO", { x: x + 42, y: y + height - 28, size: 9.7, font: fonts.bold, color: rgb(0.07, 0.09, 0.16) });
  page.drawText("Verificación digital", { x: x + 332, y: y + height - 24, size: 9.2, font: fonts.bold, color: rgb(0.07, 0.09, 0.16) });
  page.drawText("Firmado electrónicamente por:", { x: x + 14, y: y + 94, size: 8.8, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  page.drawImage(options.signatureImage, { x: x + 12, y: y + 50, width: 246, height: 50 });
  page.drawLine({ start: { x: x + 14, y: y + 53 }, end: { x: x + 238, y: y + 53 }, thickness: 0.6, color: rgb(0.78, 0.81, 0.86) });
  page.drawText("Instructor de Conductores", { x: x + 14, y: y + 39, size: 8.6, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  page.drawText(`RUT N. ${input.instructorDocumentNumber}`, { x: x + 14, y: y + 23, size: 8.6, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  drawCalendarIcon(page, x + 14, y + 7);
  page.drawText(`Fecha de emisión: ${formatLongPreviewDate(options.issuedDate)}`, { x: x + 36, y: y + 8, size: 8.2, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  page.drawImage(options.qrImage, { x: x + 331, y: y + 51, width: 82, height: 82 });
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
    ["Código de certificado", options.folio],
    ["Código de perfil", input.instructorProfileCode],
    ["Emitido el", formatPreviewDate(options.issuedDate)],
    ["Vigente hasta", formatPreviewDate(options.validUntil)]
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

export async function generateCompetencyPreviewPdf(input: CompetencyPreviewPdfInput): Promise<CompetencyPreviewPdfResult> {
  const folio = `CAC-${new Date().getFullYear()}-PREV`;
  const issuedDate = new Date().toISOString().slice(0, 10);
  const validUntil = addYears(input.trainingDate, 2);
  const verificationUrl = buildPreviewVerificationUrl(folio);
  const pdfDoc = await PDFDocument.create();
  const modelRows = input.authorizedModels.length > 0 ? input.authorizedModels : [{ brandName: "", typeName: "", modelName: "" }];
  const pageTotal = calculateCertificatePageCount(modelRows.length);
  let pageNumber = 1;
  let page = pdfDoc.addPage([595.28, 841.89]);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdfDoc.embedPng(await fetchBytes(resolveLogoUrl(input.workerCompanyName)));
  const busIcon = await pdfDoc.embedPng(await fetchBytes(certificateBusIconUrl));
  const validationBadge = await pdfDoc.embedPng(await fetchBytes(certificateValidationBadgeUrl));
  const signatureImage = await pdfDoc.embedPng(await renderSignatureImage(input.instructorName));
  const qrImage = await pdfDoc.embedPng(await renderQrImage(verificationUrl));
  drawCertificateHeader(page, logo, { regular, bold }, pageNumber, pageTotal);

  const bodyX = 64;
  const bodyWidth = 467;
  let y = 674;
  y = drawRichParagraph(page, [
    { text: `Don ${input.instructorName}, RUT N. ${input.instructorDocumentNumber}, en su calidad de`, font: regular },
    { text: "Instructor de Conductores,", font: bold },
    { text: "certifica que don", font: regular },
    { text: `${input.workerName}, RUT N. ${input.workerDocumentNumber},`, font: bold },
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
    { text: `para conducir y operar los equipos individualizados en este certificado, con vigencia desde el ${formatLongPreviewDate(input.trainingDate)} hasta el ${formatLongPreviewDate(validUntil)}.`, font: regular }
  ], {
    x: bodyX,
    y,
    width: bodyWidth,
    size: 10.6,
    lineHeight: 16.6
  });

  const firstPageRows = modelRows.slice(0, FIRST_PAGE_MODEL_CAPACITY);
  let remainingRows = modelRows.slice(FIRST_PAGE_MODEL_CAPACITY);
  const sectionY = 430;
  drawEquipmentHeading(page, sectionY, bold, busIcon);
  drawModelSummary(page, firstPageRows, { regular, bold }, sectionY - 22);

  if (remainingRows.length === 0) {
    drawValidationPanel(page, input, { regular, bold }, { folio, issuedDate, validUntil, validationBadge, signatureImage, qrImage });
    drawCertificateFooter(page, regular, verificationUrl);
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
    drawValidationPanel(page, input, { regular, bold }, { folio, issuedDate, validUntil, validationBadge, signatureImage, qrImage });
    drawCertificateFooter(page, regular, verificationUrl);
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });

  return {
    folio,
    objectUrl: URL.createObjectURL(blob)
  };
}
