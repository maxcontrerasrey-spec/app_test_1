interface CommunicationsStorageEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  R2_BUCKET?: {
    get: (key: string) => Promise<{
      body: ReadableStream<Uint8Array>;
      size: number;
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    } | null>;
    head: (key: string) => Promise<unknown | null>;
    put: (key: string, value: ArrayBuffer, options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }) => Promise<unknown>;
    delete: (key: string) => Promise<void>;
  };
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function bearer(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPdfSignature(bytes: Uint8Array) {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeFilename(value: string) {
  const name = value.trim().replace(/[\r\n"\\/]/g, "_").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180);
  return name.toLowerCase().endsWith(".pdf") ? name : `${name || "boletin"}.pdf`;
}

async function configuration(env: CommunicationsStorageEnv) {
  const baseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  if (!baseUrl || !anonKey) throw new Error("runtime_not_configured");
  return { baseUrl, anonKey };
}

async function rpc(env: CommunicationsStorageEnv, token: string, name: string, body: Record<string, unknown>) {
  const { baseUrl, anonKey } = await configuration(env);
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: anonKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (response.status === 401) throw new Error("unauthorized");
  if (!response.ok) throw new Error(payload?.message || "communications_storage_operation_failed");
  return payload;
}

async function upload(request: Request, env: CommunicationsStorageEnv) {
  const token = bearer(request);
  if (!token) return json({ error: "unauthorized" }, 401);
  if (!env.R2_BUCKET) return json({ error: "r2_not_configured" }, 503);
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (Number.isSafeInteger(declaredSize) && declaredSize > MAX_PDF_BYTES + 256 * 1024) {
    return json({ error: "invalid_pdf_size_max_20mb" }, 413);
  }

  let objectKey: string | null = null;
  try {
    const canManage = await rpc(env, token, "user_can_manage_communications", {});
    if (canManage !== true) return json({ error: "forbidden" }, 403);
    const form = await request.formData();
    const itemId = String(form.get("itemId") ?? "").trim();
    const file = form.get("file");
    if (!isUuid(itemId)) return json({ error: "invalid_bulletin_reference" }, 400);
    if (!(file instanceof File) || file.size <= 0 || file.size > MAX_PDF_BYTES) return json({ error: "invalid_pdf_size_max_20mb" }, 413);
    if (file.type !== "application/pdf") return json({ error: "pdf_only" }, 415);
    const bytes = await file.arrayBuffer();
    if (!isPdfSignature(new Uint8Array(bytes))) return json({ error: "invalid_pdf_signature" }, 415);
    const hash = await sha256(bytes);

    const canUpload = await rpc(env, token, "can_upload_communications_pdf", { p_item_id: itemId });
    if (canUpload !== true) return json({ error: "bulletin_must_be_draft_and_unattached" }, 409);

    objectKey = `communications/${itemId}/${crypto.randomUUID()}.pdf`;
    await env.R2_BUCKET.put(objectKey, bytes, {
      httpMetadata: { contentType: "application/pdf", cacheControl: "private, no-store" },
      customMetadata: { module: "communications", itemId, sha256: hash, schemaVersion: "1" }
    });

    try {
      await rpc(env, token, "attach_communications_pdf", {
        p_item_id: itemId,
        p_object_key: objectKey,
        p_filename: safeFilename(file.name),
        p_size_bytes: file.size,
        p_sha256: hash
      });
    } catch (error) {
      await env.R2_BUCKET.delete(objectKey).catch(() => undefined);
      throw error;
    }
    return json({ stored: true, provider: "cloudflare_r2", filename: safeFilename(file.name), sizeBytes: file.size, sha256: hash });
  } catch (error) {
    const message = error instanceof Error ? error.message : "communications_storage_operation_failed";
    if (message === "unauthorized") return json({ error: "unauthorized" }, 401);
    if (message.toLocaleLowerCase().includes("sin permisos")) return json({ error: "forbidden" }, 403);
    if (message === "runtime_not_configured") return json({ error: "storage_runtime_not_configured" }, 503);
    return json({ error: "communications_upload_failed" }, 500);
  }
}

async function download(request: Request, env: CommunicationsStorageEnv) {
  const token = bearer(request);
  if (!token) return json({ error: "unauthorized" }, 401);
  if (!env.R2_BUCKET) return json({ error: "r2_not_configured" }, 503);
  const itemId = new URL(request.url).searchParams.get("item_id")?.trim() || "";
  if (!isUuid(itemId)) return json({ error: "invalid_bulletin_reference" }, 400);

  try {
    const artifact = await rpc(env, token, "get_communications_pdf", { p_item_id: itemId }) as {
      object_key?: string; filename?: string; size_bytes?: number; sha256?: string
    } | null;
    if (!artifact?.object_key || !artifact.filename || !artifact.sha256
      || !new RegExp(`^communications/${itemId}/[0-9a-f-]{36}\\.pdf$`).test(artifact.object_key)) {
      return json({ error: "bulletin_not_available" }, 404);
    }
    const object = await env.R2_BUCKET.get(artifact.object_key);
    if (!object) return json({ error: "bulletin_file_missing" }, 404);
    if (object.size !== artifact.size_bytes
      || object.customMetadata?.module !== "communications"
      || object.customMetadata?.itemId !== itemId
      || object.customMetadata?.sha256 !== artifact.sha256) {
      return json({ error: "bulletin_integrity_mismatch" }, 409);
    }
    return new Response(object.body, {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(object.size),
        "content-disposition": `attachment; filename="${safeFilename(artifact.filename)}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        vary: "Authorization"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "communications_download_failed";
    if (message === "unauthorized") return json({ error: "unauthorized" }, 401);
    if (message.toLocaleLowerCase().includes("sin permisos")) return json({ error: "forbidden" }, 403);
    if (message === "runtime_not_configured") return json({ error: "storage_runtime_not_configured" }, 503);
    return json({ error: "communications_download_failed" }, 500);
  }
}

export const onRequest: PagesFunction<CommunicationsStorageEnv> = async ({ request, env }) => {
  if (request.method === "POST") return upload(request, env);
  if (request.method === "GET") return download(request, env);
  return json({ error: "method_not_allowed" }, 405);
};
