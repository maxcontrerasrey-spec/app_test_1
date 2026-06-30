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
  supabase: ReturnType<typeof createClient>,
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
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await assertAccreditationAccess(supabase, accessToken);

    const formData = await req.formData();
    const employeeId = String(formData.get("employeeId") ?? "").trim();
    const documentName = String(formData.get("documentName") ?? "").trim();
    const file = formData.get("file");

    if (!employeeId) {
      throw new Error("Debe indicar el identificador BUK del trabajador.");
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

    const bukFileName = sanitizeFileName(documentName || file.name, employeeId);
    const uploadResult = await uploadBukDocument(employeeId, bukFileName, file);
    const payload = uploadResult.payload;
    const { bukDocumentId, bukDocumentUrl } = extractBukDocumentMetadata(payload);

    return new Response(
      JSON.stringify({
        success: true,
        transport: uploadResult.transport,
        bukStatus: uploadResult.status,
        bukDocumentId: bukDocumentId ? String(bukDocumentId) : null,
        bukDocumentUrl: bukDocumentUrl ? String(bukDocumentUrl) : null,
        documentName: bukFileName,
        payload
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
