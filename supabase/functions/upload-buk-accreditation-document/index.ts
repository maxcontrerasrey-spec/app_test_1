import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function requireEnv(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing ${label}`);
  }

  return normalized;
}

function buildBukBaseUrl() {
  return (Deno.env.get("BUK_EMPLOYEES_URL") ?? "https://busesjm.buk.cl/api/v1/chile/employees").trim();
}

function buildBukDocumentsUrl(employeeId: string | number) {
  const template = (
    Deno.env.get("BUK_EMPLOYEE_DOCUMENTS_URL_TEMPLATE") ??
    `${buildBukBaseUrl()}/{employee_id}/documents`
  ).trim();

  return template.replace("{employee_id}", encodeURIComponent(String(employeeId)));
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

async function uploadBukDocument(employeeId: string, documentName: string, fileBlob: Blob) {
  const formData = new FormData();
  formData.append("file", fileBlob, documentName);
  formData.append("name", documentName);

  const authToken = requireEnv(Deno.env.get("BUK_AUTH_TOKEN"), "BUK_AUTH_TOKEN");
  const response = await fetch(buildBukDocumentsUrl(employeeId), {
    method: "POST",
    headers: {
      auth_token: authToken
    },
    body: formData
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`Buk document upload ${response.status} ${response.statusText}: ${rawBody}`);
  }

  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return { raw: rawBody };
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
    const payload = await uploadBukDocument(employeeId, bukFileName, file);
    const bukDocumentId =
      payload?.data?.id ??
      payload?.id ??
      payload?.document_id ??
      null;
    const bukDocumentUrl =
      payload?.data?.url ??
      payload?.url ??
      payload?.document_url ??
      null;

    return new Response(
      JSON.stringify({
        success: true,
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
