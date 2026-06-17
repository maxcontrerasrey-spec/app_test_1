import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { extractBukDocumentMetadata, uploadBukDocument } from "../_shared/bukDocuments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
