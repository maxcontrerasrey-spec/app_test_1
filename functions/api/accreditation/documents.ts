interface AccreditationStorageEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  R2_BUCKET?: {
    head: (key: string) => Promise<{ key: string; size: number; httpMetadata?: Record<string, string> } | null>;
    put: (key: string, value: ArrayBuffer, options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }) => Promise<unknown>;
  };
}

const MAX_FILE_SIZE_BYTES = 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function bearer(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

function signatureMatches(bytes: Uint8Array, mimeType: string) {
  const starts = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (mimeType === "application/pdf") return starts([0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (mimeType === "image/jpeg") return starts([0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return false;
}

async function sha256Hex(value: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

async function authenticatedUser(env: AccreditationStorageEnv, token: string) {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) throw new Error("Storage runtime is not configured");

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error("Unauthorized");
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), anonKey };
}

async function rpc(env: AccreditationStorageEnv, token: string, name: string, body: Record<string, unknown>) {
  const { supabaseUrl, anonKey } = await authenticatedUser(env, token);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: anonKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(String((payload as { message?: unknown } | null)?.message || `RPC ${name} failed`));
  return payload;
}

export const onRequest: PagesFunction<AccreditationStorageEnv> = async ({ request, env }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = bearer(request);
  if (!token) return json({ error: "unauthorized" }, 401);
  if (!env.R2_BUCKET) return json({ error: "r2_not_configured" }, 503);

  try {
    const formData = await request.formData();
    const employeeId = String(formData.get("employeeId") ?? "").trim();
    const documentNumber = String(formData.get("documentNumber") ?? "").trim();
    const contractCode = String(formData.get("contractCode") ?? "").trim();
    const requirementCode = String(formData.get("requirementCode") ?? "").trim();
    const siteId = String(formData.get("siteId") ?? "").trim();
    const requirementId = String(formData.get("requirementId") ?? "").trim();
    const status = String(formData.get("status") ?? "submitted").trim();
    const issueDate = String(formData.get("issueDate") ?? "").trim() || null;
    const expiryDate = String(formData.get("expiryDate") ?? "").trim() || null;
    const reviewerNotes = String(formData.get("reviewerNotes") ?? "").trim() || null;
    const file = formData.get("file");
    const documentName = String(formData.get("documentName") ?? (file instanceof File ? file.name : "documento.pdf")).trim();

    if (!employeeId || !siteId || !requirementId || !contractCode || !documentNumber || !requirementCode) {
      throw new Error("Faltan contrato, RUT o requisito para construir la ruta documental.");
    }
    if (!(file instanceof File) || file.size <= 0) throw new Error("Debe adjuntar un archivo.");
    if (file.size >= MAX_FILE_SIZE_BYTES) throw new Error("El archivo debe pesar menos de 1 MB.");
    if (!ALLOWED_FILE_TYPES.has(file.type)) throw new Error("Solo se permiten archivos PDF, PNG o JPG.");

    const bytes = await file.arrayBuffer();
    if (!signatureMatches(new Uint8Array(bytes), file.type)) throw new Error("El contenido no coincide con el formato declarado.");
    const fileSha256 = await sha256Hex(bytes);
    const normalizedName = documentName || `${file.name}`;
    const objectKey = `accreditation/${safeSegment(contractCode)}/${safeSegment(documentNumber)}/${safeSegment(requirementCode)}/${safeSegment(normalizedName)}`;
    const existing = await env.R2_BUCKET.head(objectKey);
    if (!existing) {
      await env.R2_BUCKET.put(objectKey, bytes, {
        httpMetadata: { contentType: file.type, contentDisposition: `inline; filename="${file.name.replace(/[\"\r\n]/g, "_")}"` },
        customMetadata: { module: "accreditation", employeeId, documentNumber, contractCode, siteId, requirementId, requirementCode, sha256: fileSha256 }
      });
    }

    const trackingId = await rpc(env, token, "upsert_worker_accreditation_document", {
      p_buk_employee_id: employeeId,
      p_site_id: siteId,
      p_requirement_id: requirementId,
      p_status: status,
      p_issue_date: issueDate,
      p_expiry_date: expiryDate,
      p_reviewer_notes: reviewerNotes,
      p_metadata: {
        storage_provider: "cloudflare_r2",
        r2_storage_status: "stored",
        r2_bucket: "erp-module-files",
        r2_object_key: objectKey,
        r2_mime_type: file.type,
        r2_size_bytes: file.size,
        r2_sha256: fileSha256,
        r2_uploaded_at: new Date().toISOString(),
        buk_sync_status: "pending",
        upload_source: "cloudflare_r2"
      }
    });

    return json({ success: true, trackingId, storageProvider: "cloudflare_r2", objectKey, fileSha256, bukSyncStatus: "pending" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Unauthorized" ? 401 : message.includes("Sin permisos") ? 403 : message.includes("RPC") ? 400 : 500;
    return json({ error: message }, status);
  }
};
