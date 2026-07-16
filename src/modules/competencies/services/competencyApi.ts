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
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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
      declarationAccepted: input.declarationAccepted,
      notes: input.notes
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

function drawCertificateHeader(page: PDFPage, logo: Awaited<ReturnType<PDFDocument["embedPng"]>>, fonts: { regular: PDFFont; bold: PDFFont }) {
  const border = rgb(0.16, 0.18, 0.22);
  page.drawRectangle({ x: 32, y: 721, width: 531, height: 101, borderColor: border, borderWidth: 0.85 });
  page.drawLine({ start: { x: 153, y: 721 }, end: { x: 153, y: 822 }, thickness: 0.65, color: border });
  page.drawLine({ start: { x: 454, y: 721 }, end: { x: 454, y: 822 }, thickness: 0.65, color: border });
  page.drawImage(logo, { x: 70, y: 740, width: 72, height: 72 });
  drawCenteredText(page, "Certificado de Acreditación", 153, 778, 301, fonts.bold, 21);
  drawCenteredText(page, "de Competencias", 153, 748, 301, fonts.bold, 21);
  page.drawText("Código: F-OPE-068", { x: 466, y: 789, size: 9.2, font: fonts.regular, color: rgb(0.04, 0.05, 0.08) });
  page.drawText("Fecha: 01-08-2024", { x: 466, y: 766, size: 9.2, font: fonts.regular, color: rgb(0.04, 0.05, 0.08) });
  page.drawText("Version: 00", { x: 466, y: 743, size: 9.2, font: fonts.regular, color: rgb(0.04, 0.05, 0.08) });
  page.drawText("Página: 1 de 1", { x: 466, y: 724, size: 9.2, font: fonts.regular, color: rgb(0.04, 0.05, 0.08) });
}

function drawBusIcon(page: PDFPage, x: number, y: number) {
  page.drawCircle({ x: x + 14, y: y + 14, size: 14, color: rgb(0.82, 0.03, 0.07) });
  page.drawRectangle({ x: x + 7, y: y + 8, width: 14, height: 15, borderColor: rgb(1, 1, 1), borderWidth: 1.2 });
  page.drawLine({ start: { x: x + 10, y: y + 18 }, end: { x: x + 18, y: y + 18 }, thickness: 1, color: rgb(1, 1, 1) });
  page.drawCircle({ x: x + 10, y: y + 7, size: 1.8, color: rgb(1, 1, 1) });
  page.drawCircle({ x: x + 18, y: y + 7, size: 1.8, color: rgb(1, 1, 1) });
}

function drawShieldIcon(page: PDFPage, x: number, y: number, font: PDFFont) {
  page.drawText("OK", { x, y, size: 8.5, font, color: rgb(0.82, 0.03, 0.07) });
}

function drawCalendarIcon(page: PDFPage, x: number, y: number) {
  const red = rgb(0.82, 0.03, 0.07);
  page.drawRectangle({ x, y, width: 12, height: 12, borderColor: red, borderWidth: 1 });
  page.drawLine({ start: { x, y: y + 8 }, end: { x: x + 12, y: y + 8 }, thickness: 1, color: red });
}

function drawPseudoQr(page: PDFPage, x: number, y: number, size: number) {
  const cell = size / 13;
  page.drawRectangle({ x, y, width: size, height: size, borderColor: rgb(0.55, 0.58, 0.62), borderWidth: 0.5 });
  for (let row = 0; row < 13; row += 1) {
    for (let col = 0; col < 13; col += 1) {
      const finder =
        (row < 4 && col < 4) ||
        (row < 4 && col > 8) ||
        (row > 8 && col < 4);
      if (finder || (row * 7 + col * 5 + row * col) % 4 === 0) {
        page.drawRectangle({
          x: x + col * cell + 1,
          y: y + row * cell + 1,
          width: Math.max(1.5, cell - 1.5),
          height: Math.max(1.5, cell - 1.5),
          color: rgb(0.02, 0.02, 0.02)
        });
      }
    }
  }
}

function drawModelSummary(page: PDFPage, rows: CompetencyPreviewPdfInput["authorizedModels"], fonts: { regular: PDFFont; bold: PDFFont }, tableY: number) {
  const tableX = 54;
  const tableWidth = 487;
  const headerHeight = 26;
  const rowHeight = 27;
  const columns = [88, 185, 214];
  const visibleRows = rows.slice(0, 6);
  const totalHeight = headerHeight + visibleRows.length * rowHeight;

  page.drawRectangle({
    x: tableX,
    y: tableY - totalHeight,
    width: tableWidth,
    height: totalHeight,
    borderColor: rgb(0.35, 0.39, 0.46),
    borderWidth: 0.65
  });
  page.drawRectangle({
    x: tableX,
    y: tableY - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: rgb(0.96, 0.97, 0.98)
  });

  let x = tableX;
  ["Marca", "Tipo de equipo", "Modelo / configuración autorizada"].forEach((label, index) => {
    drawCenteredText(page, label, x, tableY - 17, columns[index], fonts.bold, 9.7);
    if (index < columns.length - 1) {
      page.drawLine({
        start: { x: x + columns[index], y: tableY },
        end: { x: x + columns[index], y: tableY - totalHeight },
        thickness: 0.5,
        color: rgb(0.64, 0.67, 0.72)
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
    drawFittedText(page, row.brandName, {
      x: tableX + 10,
      y: y + 9,
      width: columns[0] - 20,
      size: 10.3,
      font: fonts.regular
    });
    drawFittedText(page, row.typeName, {
      x: tableX + columns[0] + 8,
      y: y + 9,
      width: columns[1] - 16,
      size: 10.3,
      font: fonts.regular
    });
    drawFittedText(page, row.modelName, {
      x: tableX + columns[0] + columns[1] + 8,
      y: y + 9,
      width: columns[2] - 16,
      size: 10.3,
      font: fonts.regular
    });
  }

  return tableY - totalHeight;
}

function drawValidationPanel(page: PDFPage, input: CompetencyPreviewPdfInput, fonts: { regular: PDFFont; bold: PDFFont; signature: PDFFont }, options: {
  folio: string;
  issuedDate: string;
  validUntil: string;
}) {
  const x = 54;
  const y = 116;
  const width = 487;
  const height = 168;
  const red = rgb(0.82, 0.03, 0.07);
  page.drawRectangle({ x, y, width, height, borderColor: rgb(0.55, 0.59, 0.66), borderWidth: 0.7 });
  page.drawLine({ start: { x: x + 274, y: y + 26 }, end: { x: x + 274, y: y + height - 38 }, thickness: 0.7, color: rgb(0.55, 0.59, 0.66) });
  drawShieldIcon(page, x + 15, y + height - 30, fonts.bold);
  page.drawText("VALIDACIÓN DEL CERTIFICADO", { x: x + 42, y: y + height - 28, size: 10.8, font: fonts.bold, color: rgb(0.07, 0.09, 0.16) });
  page.drawText("Verificación digital", { x: x + 332, y: y + height - 28, size: 10.2, font: fonts.bold, color: rgb(0.07, 0.09, 0.16) });
  page.drawText("Firmado electrónicamente por:", { x: x + 14, y: y + 104, size: 10, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  drawScaledText(page, input.instructorName, { x: x + 14, y: y + 68, width: 245, size: 21, minSize: 13, font: fonts.signature });
  page.drawLine({ start: { x: x + 14, y: y + 58 }, end: { x: x + 238, y: y + 58 }, thickness: 0.6, color: rgb(0.78, 0.81, 0.86) });
  page.drawText("Instructor de Conductores", { x: x + 14, y: y + 42, size: 9.5, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  page.drawText(`RUT N. ${input.instructorDocumentNumber}`, { x: x + 14, y: y + 24, size: 9.5, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  drawCalendarIcon(page, x + 14, y + 7);
  page.drawText(`Fecha de emisión: ${formatLongPreviewDate(options.issuedDate)}`, { x: x + 36, y: y + 8, size: 9.2, font: fonts.regular, color: rgb(0.07, 0.09, 0.16) });
  drawPseudoQr(page, x + 333, y + 58, 82);
  drawCenteredText(page, "Escanee el codigo QR para verificar", x + 295, y + 38, 170, fonts.regular, 8.8);
  drawCenteredText(page, "la autenticidad, estado y vigencia", x + 295, y + 24, 170, fonts.regular, 8.8);
  drawCenteredText(page, "de este certificado.", x + 295, y + 10, 170, fonts.regular, 8.8);

  const boxY = 46;
  const boxH = 58;
  const boxW = 487;
  const cellW = boxW / 4;
  page.drawRectangle({ x, y: boxY, width: boxW, height: boxH, borderColor: rgb(0.55, 0.59, 0.66), borderWidth: 0.7 });
  for (let index = 1; index < 4; index += 1) {
    page.drawLine({ start: { x: x + cellW * index, y: boxY }, end: { x: x + cellW * index, y: boxY + boxH }, thickness: 0.55, color: rgb(0.64, 0.67, 0.72) });
  }
  const summary = [
    ["Código de certificado", options.folio],
    ["Código de perfil", input.instructorProfileCode],
    ["Emitido el", formatPreviewDate(options.issuedDate)],
    ["Vigente hasta", formatPreviewDate(options.validUntil)]
  ];
  summary.forEach((item, index) => {
    const cellX = x + cellW * index;
    drawCenteredText(page, item[0], cellX, boxY + 25, cellW, fonts.bold, 9.5);
    const valueFont = index === 3 ? fonts.bold : fonts.regular;
    const valueColor = index === 3 ? red : rgb(0.07, 0.09, 0.16);
    page.drawText(item[1], { x: cellX + (cellW - valueFont.widthOfTextAtSize(item[1], 9.2)) / 2, y: boxY + 9, size: 9.2, font: valueFont, color: valueColor });
  });
}

export async function generateCompetencyPreviewPdf(input: CompetencyPreviewPdfInput): Promise<CompetencyPreviewPdfResult> {
  const folio = `CAC-${new Date().getFullYear()}-PREV`;
  const issuedDate = new Date().toISOString().slice(0, 10);
  const validUntil = addYears(input.trainingDate, 2);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const signatureFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const logo = await pdfDoc.embedPng(await fetchBytes(resolveLogoUrl(input.workerCompanyName)));
  drawCertificateHeader(page, logo, { regular, bold });

  const bodyX = 64;
  const bodyWidth = 467;
  let y = 666;
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
    size: 12,
    lineHeight: 20
  });
  y = drawRichParagraph(page, [
    { text: "De acuerdo con los procedimientos y estándares definidos por la empresa, el trabajador obtuvo una calificación final de 100 %, acreditando los conocimientos, habilidades y competencias requeridas para conducir y operar los equipos señalados en el cuadro de autorización.", font: regular }
  ], {
    x: bodyX,
    y,
    width: bodyWidth,
    size: 12,
    lineHeight: 20
  });
  y = drawRichParagraph(page, [
    { text: "En virtud de lo anterior, el trabajador queda", font: regular },
    { text: "HABILITADO", font: bold, color: rgb(0.82, 0.03, 0.07) },
    { text: `para conducir y operar los equipos individualizados en este certificado, con vigencia desde el ${formatLongPreviewDate(input.trainingDate)} hasta el ${formatLongPreviewDate(validUntil)}.`, font: regular }
  ], {
    x: bodyX,
    y,
    width: bodyWidth,
    size: 12,
    lineHeight: 20
  });

  const sectionY = Math.min(y + 4, 356);
  drawBusIcon(page, 52, sectionY - 18);
  page.drawText("EQUIPOS AUTORIZADOS", { x: 94, y: sectionY - 8, size: 12.2, font: bold, color: rgb(0.07, 0.09, 0.16) });
  page.drawLine({ start: { x: 268, y: sectionY - 5 }, end: { x: 540, y: sectionY - 5 }, thickness: 1, color: rgb(0.82, 0.03, 0.07) });
  drawModelSummary(page, input.authorizedModels, { regular, bold }, sectionY - 22);
  drawValidationPanel(page, input, { regular, bold, signature: signatureFont }, { folio, issuedDate, validUntil });
  drawCenteredText(page, "Este certificado es válido únicamente con firma electrónica y puede ser verificado a", 82, 24, 431, regular, 8.8);
  drawCenteredText(page, "través del código QR o en el portal de validación del ERP.", 82, 10, 431, regular, 8.8);

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });

  return {
    folio,
    objectUrl: URL.createObjectURL(blob)
  };
}
