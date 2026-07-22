import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractBukDocumentMetadata, uploadBukDocument } from "../_shared/bukDocuments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png"
]);
type EdgeClient = ReturnType<typeof createClient<any, "public", any>>;

function requireEnv(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing ${label}`);
  }

  return normalized;
}

function resolveErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") {
    return 401;
  }
  if (message.includes("Sin permisos")) {
    return 403;
  }
  if (
    message.includes("Debe") ||
    message.includes("Solo se permiten") ||
    message.includes("supera el maximo")
  ) {
    return 400;
  }

  return 500;
}

function sanitizeFileName(fileName: string, employeeId: string) {
  const safeBaseName = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  const extension = safeBaseName.includes(".")
    ? safeBaseName.slice(safeBaseName.lastIndexOf("."))
    : ".pdf";
  const stem = safeBaseName.replace(/\.[^.]+$/, "");
  return `${stem || "documento"}_${employeeId}${extension}`;
}

async function assertAccreditationAccess(
  supabase: EdgeClient,
  accessToken: string
) {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase.rpc("user_can_manage_accreditation", {
    p_user_id: user.id
  });

  if (error) {
    throw new Error(`No fue posible validar permisos de acreditacion: ${error.message}`);
  }

  if (data !== true) {
    throw new Error("Sin permisos para subir documentos de acreditacion.");
  }

  return user.id;
}

async function sha256Hex(value: ArrayBuffer | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = requireEnv(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
    const serviceRoleKey = requireEnv(
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      "SUPABASE_SERVICE_ROLE_KEY"
    );
    const anonKey = requireEnv(Deno.env.get("SUPABASE_ANON_KEY"), "SUPABASE_ANON_KEY");
    const supabase = createClient<any, "public", any>(supabaseUrl, serviceRoleKey);
    const actorSupabase = createClient<any, "public", any>(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const actorUserId = await assertAccreditationAccess(actorSupabase, accessToken);

    const formData = await req.formData();
    const employeeId = String(formData.get("employeeId") ?? "").trim();
    const documentName = String(formData.get("documentName") ?? "").trim();
    const siteId = String(formData.get("siteId") ?? "").trim();
    const requirementId = String(formData.get("requirementId") ?? "").trim();
    const status = String(formData.get("status") ?? "submitted").trim();
    const issueDate = String(formData.get("issueDate") ?? "").trim() || null;
    const expiryDate = String(formData.get("expiryDate") ?? "").trim() || null;
    const reviewerNotes = String(formData.get("reviewerNotes") ?? "").trim() || null;
    const file = formData.get("file");

    if (!employeeId) {
      throw new Error("Debe indicar el identificador BUK del trabajador.");
    }
    if (!siteId || !requirementId) {
      throw new Error("Debe indicar faena y requisito para persistir el documento.");
    }

    if (!(file instanceof File)) {
      throw new Error("Debe adjuntar un archivo para subir a BUK.");
    }

    if (file.size <= 0) {
      throw new Error("El archivo adjunto esta vacio.");
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error("El archivo supera el maximo permitido de 10 MB.");
    }

    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      throw new Error("Solo se permiten archivos PDF, PNG o JPG para acreditacion.");
    }

    const fileBuffer = await file.arrayBuffer();
    const fileSha256 = await sha256Hex(fileBuffer);
    const operationKey = await sha256Hex(
      [employeeId, siteId, requirementId, status, issueDate ?? "", expiryDate ?? "", fileSha256].join(":")
    );
    const requestPayload = { employeeId, siteId, requirementId, status, issueDate, expiryDate, reviewerNotes, documentName };

    const { data: existingJob } = await supabase
      .from("accreditation_document_upload_jobs")
      .select("*")
      .eq("operation_key", operationKey)
      .maybeSingle();

    let uploadSnapshot = existingJob?.result_snapshot as Record<string, unknown> | null;
    if (existingJob?.status === "processing") {
      const updatedAt = Date.parse(String(existingJob.updated_at ?? existingJob.started_at ?? ""));
      if (Number.isFinite(updatedAt) && Date.now() - updatedAt < 15 * 60 * 1000) {
        throw new Error("La misma carga documental ya está en proceso.");
      }
    }

    if (!existingJob) {
      const { error: insertJobError } = await supabase
        .from("accreditation_document_upload_jobs")
        .insert({
          operation_key: operationKey,
          actor_user_id: actorUserId,
          buk_employee_id: employeeId,
          site_id: siteId,
          requirement_id: requirementId,
          file_sha256: fileSha256,
          request_payload: requestPayload,
          status: "processing",
          attempts: 1,
          started_at: new Date().toISOString()
        });
      if (insertJobError) throw new Error(`No fue posible registrar la intención de carga: ${insertJobError.message}`);
    } else if (!uploadSnapshot || !["buk_uploaded", "success"].includes(existingJob.status)) {
      const { error: retryJobError } = await supabase
        .from("accreditation_document_upload_jobs")
        .update({
          status: "processing",
          attempts: Number(existingJob.attempts ?? 0) + 1,
          error_message: null,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", existingJob.id);
      if (retryJobError) throw new Error(`No fue posible reintentar la carga: ${retryJobError.message}`);
    }

    if (!uploadSnapshot || !["buk_uploaded", "success"].includes(existingJob?.status ?? "")) {
      const bukFileName = sanitizeFileName(documentName || file.name, employeeId);
      const uploadResult = await uploadBukDocument(
        employeeId,
        bukFileName,
        new Blob([fileBuffer], { type: file.type })
      );
      const payload = uploadResult.payload;
      const { bukDocumentId, bukDocumentUrl } = extractBukDocumentMetadata(payload);
      uploadSnapshot = {
        transport: uploadResult.transport,
        bukStatus: uploadResult.status,
        bukDocumentId,
        bukDocumentUrl,
        documentName: bukFileName,
        payload
      };
      const { error: checkpointError } = await supabase
        .from("accreditation_document_upload_jobs")
        .update({
          status: "buk_uploaded",
          result_snapshot: uploadSnapshot,
          updated_at: new Date().toISOString()
        })
        .eq("operation_key", operationKey);
      if (checkpointError) throw new Error(`No fue posible persistir el checkpoint BUK: ${checkpointError.message}`);
    }

    const { error: trackingError } = await actorSupabase.rpc("upsert_worker_accreditation_document", {
      p_buk_employee_id: employeeId,
      p_site_id: siteId,
      p_requirement_id: requirementId,
      p_status: status,
      p_issue_date: issueDate,
      p_expiry_date: expiryDate,
      p_buk_document_id: uploadSnapshot.bukDocumentId ?? null,
      p_buk_document_name: uploadSnapshot.documentName ?? null,
      p_buk_document_url: uploadSnapshot.bukDocumentUrl ?? null,
      p_reviewer_notes: reviewerNotes,
      p_metadata: { upload_source: "buk_edge_function", upload_operation_key: operationKey, buk_payload: uploadSnapshot.payload ?? {} }
    });
    if (trackingError) throw new Error(`BUK recibió el documento, pero el tracking local debe reintentarse: ${trackingError.message}`);

    await supabase
      .from("accreditation_document_upload_jobs")
      .update({ status: "success", error_message: null, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("operation_key", operationKey);

    return new Response(
      JSON.stringify({
        success: true,
        persisted: true,
        operationKey,
        ...uploadSnapshot
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        status: resolveErrorStatus(error),
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
