import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";
import { extractBukDocumentMetadata, uploadBukDocument } from "../_shared/bukDocuments.ts";

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

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
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

async function buildCertificatePdf(input: {
  request: CompetencyRequestRow;
  instructor: InstructorRow;
  certificate: CertificateRow;
  issuedDate: string;
  validUntil: string;
}) {
  const { request, instructor, certificate, issuedDate, validUntil } = input;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const red = rgb(0.78, 0.04, 0.08);
  const black = rgb(0.05, 0.05, 0.05);
  const gray = rgb(0.35, 0.35, 0.35);
  const blue = rgb(0.22, 0.63, 0.91);

  page.drawRectangle({ x: 35, y: 715, width: 525, height: 92, borderColor: black, borderWidth: 0.8 });
  page.drawRectangle({ x: 35, y: 715, width: 156, height: 92, borderColor: black, borderWidth: 0.6 });
  page.drawRectangle({ x: 466, y: 715, width: 94, height: 92, borderColor: black, borderWidth: 0.6 });
  page.drawRectangle({ x: 50, y: 754, width: 42, height: 42, color: red });
  page.drawText("jm", { x: 59, y: 766, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 103, y: 732, width: 40, height: 40, color: red });
  page.drawText("CA", { x: 113, y: 746, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 149, y: 732, width: 40, height: 40, color: red });
  page.drawText("CP", { x: 159, y: 746, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Certificado de Acreditacion de", { x: 214, y: 772, size: 18, font: bold, color: black });
  page.drawText("Competencias", { x: 270, y: 744, size: 18, font: bold, color: black });
  page.drawText("Codigo: F-OPE-068", { x: 471, y: 790, size: 9, font: regular, color: black });
  page.drawText("Fecha: 01-08-2024", { x: 471, y: 766, size: 9, font: regular, color: black });
  page.drawText("Version: 00", { x: 471, y: 742, size: 9, font: regular, color: black });
  page.drawText("Pagina: 1 de 1", { x: 471, y: 720, size: 9, font: regular, color: black });

  const body = [
    `Sr. ${instructor.full_name}, Rut ${instructor.document_number}, Instructor de conductores, certifica que el conductor Sr. ${request.worker_full_name}, Rut ${request.worker_document_number}, ha realizado satisfactoriamente el proceso de capacitacion e induccion en conduccion y operacion de los equipos ${request.model_summary}.`,
    `Segun lo establecido por la empresa y de acuerdo con la evaluacion del examen Teorico y Practico de conduccion donde obtuvo una calificacion del 100%, se encuentra acreditado con las competencias especificas para conducir y operar el equipo senalado.`,
    `Con fecha ${formatDate(request.training_date)} queda HABILITADO para operar los equipos indicados.`
  ];
  let y = 625;
  for (const paragraph of body) {
    for (const line of wrapText(paragraph, 86)) {
      page.drawText(line, { x: 83, y, size: 11.2, font: regular, color: black });
      y -= 16;
    }
    y -= 10;
  }

  page.drawText("CERTIFICADO VALIDO POR 2 ANOS", { x: 211, y: 402, size: 12, font: bold, color: black });

  page.drawRectangle({ x: 94, y: 166, width: 407, height: 210, borderColor: black, borderWidth: 0.6 });
  page.drawLine({ start: { x: 94, y: 352 }, end: { x: 501, y: 352 }, thickness: 0.5, color: black });
  page.drawLine({ start: { x: 330, y: 166 }, end: { x: 330, y: 376 }, thickness: 0.5, color: black });
  page.drawText("Firma instructor", { x: 172, y: 360, size: 12, font: bold, color: black });
  page.drawText("Codigo QR Instructor", { x: 374, y: 360, size: 12, font: bold, color: black });
  page.drawText("Firmado digitalmente por:", { x: 100, y: 320, size: 11, font: serif, color: black });
  page.drawText(instructor.signature_label || instructor.full_name, { x: 100, y: 295, size: 11, font: serif, color: gray });
  page.drawText(`el ${formatDate(issuedDate)}`, { x: 100, y: 270, size: 11, font: serif, color: gray });
  page.drawCircle({ x: 304, y: 275, size: 9, color: blue });
  page.drawText("OK", { x: 298, y: 272, size: 5.5, font: bold, color: rgb(1, 1, 1) });

  const qrDataUrl = await QRCode.toDataURL(buildVerificationUrl(certificate.verification_token), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 150
  });
  const qrPng = await pdfDoc.embedPng(dataUrlToBytes(qrDataUrl));
  page.drawImage(qrPng, { x: 372, y: 223, width: 92, height: 92 });

  page.drawLine({ start: { x: 94, y: 238 }, end: { x: 501, y: 238 }, thickness: 0.5, color: black });
  page.drawLine({ start: { x: 94, y: 214 }, end: { x: 501, y: 214 }, thickness: 0.5, color: black });
  page.drawLine({ start: { x: 94, y: 190 }, end: { x: 501, y: 190 }, thickness: 0.5, color: black });
  page.drawLine({ start: { x: 225, y: 166 }, end: { x: 225, y: 238 }, thickness: 0.5, color: black });
  page.drawText("Codigo Perfil", { x: 100, y: 222, size: 11, font: bold, color: black });
  page.drawText(instructor.profile_code, { x: 234, y: 222, size: 10, font: regular, color: black });
  page.drawText("Codigo Certificado", { x: 100, y: 198, size: 11, font: bold, color: black });
  page.drawText(certificate.folio, { x: 234, y: 198, size: 10, font: regular, color: black });
  page.drawText("Vencimiento", { x: 100, y: 174, size: 11, font: bold, color: black });
  page.drawText(formatDate(validUntil), { x: 234, y: 174, size: 10, font: regular, color: black });

  page.drawCircle({ x: 67, y: 58, size: 25, borderColor: rgb(0.35, 0.49, 0.66), borderWidth: 1 });
  page.drawText("ISO", { x: 58, y: 66, size: 8, font: bold, color: rgb(0.35, 0.49, 0.66) });
  page.drawText("45001", { x: 54, y: 55, size: 7, font: regular, color: rgb(0.35, 0.49, 0.66) });

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
    const pdfBytes = await buildCertificatePdf({
      request: requestRow,
      instructor: instructorRow,
      certificate: certificateRow,
      issuedDate,
      validUntil
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
