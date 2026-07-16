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

function sanitizePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function formatPreviewDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return [day, month, year].filter(Boolean).join("-");
}

function wrapPreviewText(value: string, maxLength: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
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

function addYears(dateValue: string, years: number) {
  const source = new Date(`${dateValue || new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  source.setUTCFullYear(source.getUTCFullYear() + years);
  return source.toISOString().slice(0, 10);
}

function drawText(value: string, x: number, y: number, size = 10, font = "F1") {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${sanitizePdfText(value)}) Tj ET`;
}

function drawRect(x: number, y: number, width: number, height: number) {
  return `${x} ${y} ${width} ${height} re S`;
}

function fillRect(x: number, y: number, width: number, height: number, color = "0.78 0.04 0.08") {
  return `q ${color} rg ${x} ${y} ${width} ${height} re f Q`;
}

function drawLine(x1: number, y1: number, x2: number, y2: number) {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

function drawQrPlaceholder(x: number, y: number, size: number) {
  const cell = size / 7;
  const blocks: string[] = [`q 0 g ${x} ${y} ${size} ${size} re S`];
  const filled = [
    [0, 0], [1, 0], [2, 0], [4, 0], [6, 0],
    [0, 1], [2, 1], [3, 1], [5, 1],
    [0, 2], [1, 2], [4, 2], [6, 2],
    [2, 3], [3, 3], [5, 3],
    [0, 4], [2, 4], [4, 4], [5, 4],
    [1, 5], [3, 5], [6, 5],
    [0, 6], [2, 6], [3, 6], [5, 6], [6, 6]
  ];

  for (const [col, row] of filled) {
    blocks.push(`${x + col * cell} ${y + row * cell} ${cell * 0.78} ${cell * 0.78} re f`);
  }

  blocks.push("Q");
  return blocks.join("\n");
}

function buildCertificatePreviewCommands(input: CompetencyPreviewPdfInput, folio: string) {
  const issuedDate = new Date().toISOString().slice(0, 10);
  const validUntil = addYears(input.trainingDate, 2);
  const commands: string[] = [
    "0.05 0.05 0.05 RG 0.05 0.05 0.05 rg 0.6 w",
    drawRect(35, 715, 525, 92),
    drawRect(35, 715, 156, 92),
    drawRect(466, 715, 94, 92),
    fillRect(50, 754, 42, 42),
    drawText("jm", 59, 766, 20, "F2"),
    fillRect(103, 732, 40, 40),
    drawText("CA", 113, 746, 12, "F2"),
    fillRect(149, 732, 40, 40),
    drawText("CP", 159, 746, 12, "F2"),
    drawText("Certificado de Acreditacion de", 214, 772, 18, "F2"),
    drawText("Competencias", 270, 744, 18, "F2"),
    drawText("Codigo: F-OPE-068", 471, 790, 9),
    drawText("Fecha: 01-08-2024", 471, 766, 9),
    drawText("Version: 00", 471, 742, 9),
    drawText("Pagina: 1 de 1", 471, 720, 9),
    drawText("PREVISUALIZACION - NO REGISTRADO EN ERP NI BUK", 146, 690, 9, "F2")
  ];

  const body = [
    `Sr. ${input.instructorName}, Rut ${input.instructorDocumentNumber}, Instructor de conductores, certifica que el conductor Sr. ${input.workerName}, Rut ${input.workerDocumentNumber}, ha realizado satisfactoriamente el proceso de capacitacion e induccion en conduccion y operacion de los equipos ${input.modelSummary}.`,
    "Segun lo establecido por la empresa y de acuerdo con la evaluacion del examen Teorico y Practico de conduccion donde obtuvo una calificacion del 100%, se encuentra acreditado con las competencias especificas para conducir y operar el equipo senalado.",
    `Con fecha ${formatPreviewDate(input.trainingDate)} queda HABILITADO para operar los equipos indicados.`
  ];
  let y = 625;

  for (const paragraph of body) {
    for (const line of wrapPreviewText(paragraph, 86)) {
      commands.push(drawText(line, 83, y, 11));
      y -= 16;
    }
    y -= 10;
  }

  commands.push(drawText("CERTIFICADO VALIDO POR 2 ANOS", 211, 402, 12, "F2"));
  commands.push(drawRect(94, 166, 407, 210));
  commands.push(drawLine(94, 352, 501, 352));
  commands.push(drawLine(330, 166, 330, 376));
  commands.push(drawText("Firma instructor", 172, 360, 12, "F2"));
  commands.push(drawText("Codigo QR Instructor", 374, 360, 12, "F2"));
  commands.push(drawText("Firmado digitalmente por:", 100, 320, 11, "F3"));
  commands.push(drawText(input.instructorName, 100, 295, 11, "F3"));
  commands.push(drawText(`el ${formatPreviewDate(issuedDate)}`, 100, 270, 11, "F3"));
  commands.push(fillRect(294, 266, 22, 22, "0.22 0.63 0.91"));
  commands.push(drawText("OK", 298, 272, 5.5, "F2"));
  commands.push(drawQrPlaceholder(372, 223, 92));
  commands.push(drawLine(94, 238, 501, 238));
  commands.push(drawLine(94, 214, 501, 214));
  commands.push(drawLine(94, 190, 501, 190));
  commands.push(drawLine(225, 166, 225, 238));
  commands.push(drawText("Codigo Perfil", 100, 222, 11, "F2"));
  commands.push(drawText(input.instructorProfileCode, 234, 222, 10));
  commands.push(drawText("Codigo Certificado", 100, 198, 11, "F2"));
  commands.push(drawText(folio, 234, 198, 10));
  commands.push(drawText("Vencimiento", 100, 174, 11, "F2"));
  commands.push(drawText(formatPreviewDate(validUntil), 234, 174, 10));
  commands.push("q 0.35 0.49 0.66 RG 42 33 50 50 re S Q");
  commands.push(drawText("ISO", 58, 66, 8, "F2"));
  commands.push(drawText("45001", 54, 55, 7));

  return commands.join("\n");
}

function buildPdfString(contentCommands: string) {
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>\nendobj\n",
    `7 0 obj\n<< /Length ${contentCommands.length} >>\nstream\n${contentCommands}\nendstream\nendobj\n`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function generateCompetencyPreviewPdf(input: CompetencyPreviewPdfInput): CompetencyPreviewPdfResult {
  const folio = `PRUEBA-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
  const pdfText = buildPdfString(buildCertificatePreviewCommands(input, folio));
  const blob = new Blob([pdfText], { type: "application/pdf" });

  return {
    folio,
    objectUrl: URL.createObjectURL(blob)
  };
}
