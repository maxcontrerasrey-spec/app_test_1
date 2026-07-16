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

function drawModelSummary(page: PDFPage, input: CompetencyPreviewPdfInput, fonts: { regular: PDFFont; bold: PDFFont }) {
  const tableX = 82;
  const tableY = 365;
  const tableWidth = 431;
  const headerHeight = 22;
  const rowHeight = 20;
  const columns = [128, 128, 175];
  const rows = input.authorizedModels.slice(0, 7);

  page.drawRectangle({
    x: tableX,
    y: tableY - headerHeight - rows.length * rowHeight,
    width: tableWidth,
    height: headerHeight + rows.length * rowHeight,
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
        end: { x: x + columns[index], y: tableY - headerHeight - rows.length * rowHeight },
        thickness: 0.5,
        color: rgb(0.55, 0.58, 0.62)
      });
    }
    x += columns[index];
  });

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const y = tableY - headerHeight - (index + 1) * rowHeight;
    page.drawLine({
      start: { x: tableX, y: y + rowHeight },
      end: { x: tableX + tableWidth, y: y + rowHeight },
      thickness: 0.45,
      color: rgb(0.74, 0.76, 0.8)
    });
    drawFittedText(page, row.brandName, {
      x: tableX + 8,
      y: y + 6,
      width: columns[0] - 16,
      size: 8.5,
      font: fonts.regular
    });
    drawFittedText(page, row.typeName, {
      x: tableX + columns[0] + 8,
      y: y + 6,
      width: columns[1] - 16,
      size: 8.5,
      font: fonts.regular
    });
    drawFittedText(page, row.modelName, {
      x: tableX + columns[0] + columns[1] + 8,
      y: y + 6,
      width: columns[2] - 16,
      size: 8.5,
      font: fonts.regular
    });
  }

  return tableY - headerHeight - rows.length * rowHeight - 24;
}

export async function generateCompetencyPreviewPdf(input: CompetencyPreviewPdfInput): Promise<CompetencyPreviewPdfResult> {
  const folio = `PRUEBA-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
  const issuedDate = new Date().toISOString().slice(0, 10);
  const validUntil = addYears(input.trainingDate, 2);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const logo = await pdfDoc.embedPng(await fetchBytes(resolveLogoUrl(input.workerCompanyName)));
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
  drawCenteredText(page, "PREVISUALIZACION - NO REGISTRADO EN ERP NI BUK", 72, 685, 451, bold, 9);

  const bodyX = 82;
  const bodyWidth = 431;
  let y = 625;
  y = drawParagraph(page, `Sr. ${input.instructorName}, Rut ${input.instructorDocumentNumber}, Instructor de conductores, certifica que el conductor Sr. ${input.workerName}, Rut ${input.workerDocumentNumber}, ha realizado satisfactoriamente el proceso de capacitacion e induccion en conduccion y operacion de los equipos detallados en el cuadro de autorizacion.`, {
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
  drawParagraph(page, `Con fecha ${formatPreviewDate(input.trainingDate)} queda HABILITADO para operar los equipos indicados.`, {
    x: bodyX,
    y,
    width: bodyWidth,
    font: regular,
    size: 10.3,
    lineHeight: 15
  });

  const afterTableY = drawModelSummary(page, input, { regular, bold });
  drawCenteredText(page, "CERTIFICADO VALIDO POR 2 ANOS", 82, afterTableY, 431, bold, 11.5);

  const panelX = 105;
  const panelY = 118;
  const panelW = 385;
  const panelH = 190;
  page.drawRectangle({ x: panelX, y: panelY, width: panelW, height: panelH, borderColor: border, borderWidth: 0.65 });
  page.drawLine({ start: { x: panelX, y: panelY + panelH - 24 }, end: { x: panelX + panelW, y: panelY + panelH - 24 }, thickness: 0.5, color: border });
  page.drawLine({ start: { x: panelX + 230, y: panelY + 58 }, end: { x: panelX + 230, y: panelY + panelH }, thickness: 0.5, color: border });
  drawCenteredText(page, "Firma instructor", panelX, panelY + panelH - 17, 230, bold, 11);
  drawCenteredText(page, "Codigo QR Instructor", panelX + 230, panelY + panelH - 17, 155, bold, 11);
  page.drawText("Firmado digitalmente por:", { x: panelX + 12, y: panelY + 122, size: 10.2, font: serif, color: black });
  page.drawText(input.instructorName, { x: panelX + 12, y: panelY + 96, size: 10.2, font: serif, color: muted });
  page.drawText(`el ${formatPreviewDate(issuedDate)}`, { x: panelX + 12, y: panelY + 70, size: 10.2, font: serif, color: muted });
  page.drawRectangle({ x: panelX + 188, y: panelY + 66, width: 18, height: 18, color: rgb(0.16, 0.58, 0.82) });
  page.drawText("OK", { x: panelX + 192, y: panelY + 72, size: 5.2, font: bold, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: panelX + 267, y: panelY + 72, width: 78, height: 78, borderColor: border, borderWidth: 0.5 });
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      if ((row * 3 + col * 5) % 4 === 0 || (row + col) % 5 === 0) {
        page.drawRectangle({ x: panelX + 270 + col * 10, y: panelY + 75 + row * 10, width: 7, height: 7, color: black });
      }
    }
  }

  [["Codigo Perfil", input.instructorProfileCode], ["Codigo Certificado", folio], ["Vencimiento", formatPreviewDate(validUntil)]].forEach((row, index) => {
    const rowY = panelY + 38 - index * 20;
    page.drawLine({ start: { x: panelX, y: rowY + 20 }, end: { x: panelX + panelW, y: rowY + 20 }, thickness: 0.45, color: border });
    page.drawLine({ start: { x: panelX + 132, y: rowY }, end: { x: panelX + 132, y: rowY + 20 }, thickness: 0.45, color: border });
    page.drawText(row[0], { x: panelX + 8, y: rowY + 6, size: 9.5, font: bold, color: black });
    page.drawText(row[1], { x: panelX + 140, y: rowY + 6, size: 9.2, font: regular, color: black });
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });

  return {
    folio,
    objectUrl: URL.createObjectURL(blob)
  };
}
