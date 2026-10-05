interface CommunicationsAssetEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  R2_BUCKET?: {
    get: (key: string) => Promise<{ body: ReadableStream<Uint8Array>; size: number; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> } | null>;
    put: (key: string, value: ArrayBuffer, options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }) => Promise<unknown>;
    delete: (key: string) => Promise<void>;
  };
}

const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const formats: Record<string, { extension: string; assetTypes: string[] }> = {
  "image/jpeg": { extension: "jpg", assetTypes: ["cover", "image"] },
  "image/png": { extension: "png", assetTypes: ["cover", "image"] },
  "image/webp": { extension: "webp", assetTypes: ["cover", "image"] },
  "video/mp4": { extension: "mp4", assetTypes: ["video"] },
  "application/pdf": { extension: "pdf", assetTypes: ["attachment"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: "docx", assetTypes: ["attachment"] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { extension: "xlsx", assetTypes: ["attachment"] }
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function bearer(request: Request) { return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function safeFilename(value: string) { return value.trim().replace(/[\r\n"\\/]/g, "_").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180) || "archivo"; }
async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function signatureMatches(mime: string, bytes: Uint8Array) {
  if (mime === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === "image/webp") return bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (mime === "video/mp4") return bytes.length > 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  if (mime === "application/pdf") return bytes.length > 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (mime.endsWith("wordprocessingml.document") || mime.endsWith("spreadsheetml.sheet")) return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  return false;
}
async function configuration(env: CommunicationsAssetEnv) {
  const baseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  if (!baseUrl || !anonKey) throw new Error("runtime_not_configured");
  return { baseUrl, anonKey };
}
async function authenticatedUser(env: CommunicationsAssetEnv, token: string) {
  const config = await configuration(env);
  const response = await fetch(`${config.baseUrl}/auth/v1/user`, { headers: { apikey: config.anonKey, authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("unauthorized");
  return config;
}
async function rpc(env: CommunicationsAssetEnv, token: string, name: string, body: Record<string, unknown>) {
  const { baseUrl, anonKey } = await authenticatedUser(env, token);
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: anonKey, authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) throw new Error(payload?.message || "communications_asset_operation_failed");
  return payload;
}

async function upload(request: Request, env: CommunicationsAssetEnv) {
  const token = bearer(request);
  if (!token) return json({ error: "unauthorized" }, 401);
  if (!env.R2_BUCKET) return json({ error: "r2_not_configured" }, 503);
  if (Number(request.headers.get("content-length") || 0) > MAX_ASSET_BYTES + 256 * 1024) return json({ error: "asset_size_max_50mb" }, 413);
  let objectKey: string | null = null;
  try {
    if (await rpc(env, token, "user_can_manage_communications", {}) !== true) return json({ error: "forbidden" }, 403);
    const form = await request.formData();
    const itemId = String(form.get("itemId") ?? "").trim();
    const assetType = String(form.get("assetType") ?? "").trim();
    const file = form.get("file");
    if (!isUuid(itemId)) return json({ error: "invalid_publication_reference" }, 400);
    if (!(file instanceof File) || !file.size || file.size > MAX_ASSET_BYTES) return json({ error: "asset_size_max_50mb" }, 413);
    const format = formats[file.type];
    if (!format || !format.assetTypes.includes(assetType)) return json({ error: "file_type_not_allowed" }, 415);
    const allowed = await rpc(env, token, "can_upload_communications_asset", { p_item_id: itemId, p_asset_type: assetType });
    if (allowed !== true) return json({ error: "publication_not_editable" }, 409);
    const bytes = await file.arrayBuffer();
    if (!signatureMatches(file.type, new Uint8Array(bytes))) return json({ error: "file_signature_invalid" }, 415);
    const hash = await sha256(bytes);
    const filename = safeFilename(file.name);
    objectKey = `communications/${itemId}/assets/${crypto.randomUUID()}.${format.extension}`;
    await env.R2_BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: file.type, cacheControl: "private, no-store" }, customMetadata: { module: "communications", itemId, sha256: hash, schemaVersion: "2" } });
    try {
      const id = await rpc(env, token, "attach_communications_asset", { p_item_id: itemId, p_asset_type: assetType, p_object_key: objectKey, p_filename: filename, p_mime_type: file.type, p_size_bytes: file.size, p_sha256: hash });
      return json({ id, filename, mimeType: file.type, sizeBytes: file.size, provider: "cloudflare_r2" });
    } catch (error) {
      await env.R2_BUCKET.delete(objectKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "communications_asset_operation_failed";
    if (message === "unauthorized") return json({ error: "unauthorized" }, 401);
    if (message.toLocaleLowerCase().includes("sin permisos")) return json({ error: "forbidden" }, 403);
    if (message === "runtime_not_configured") return json({ error: "storage_runtime_not_configured" }, 503);
    if (objectKey) await env.R2_BUCKET.delete(objectKey).catch(() => undefined);
    return json({ error: "communications_asset_upload_failed" }, 500);
  }
}

async function download(request: Request, env: CommunicationsAssetEnv) {
  const token = bearer(request);
  if (!token) return json({ error: "unauthorized" }, 401);
  if (!env.R2_BUCKET) return json({ error: "r2_not_configured" }, 503);
  const assetId = new URL(request.url).searchParams.get("asset_id")?.trim() || "";
  if (!isUuid(assetId)) return json({ error: "invalid_asset_reference" }, 400);
  try {
    const asset = await rpc(env, token, "get_communications_asset", { p_asset_id: assetId }) as { id?: string; item_id?: string; asset_type?: string; object_key?: string; filename?: string; mime_type?: string; size_bytes?: number; sha256?: string } | null;
    if (!asset?.object_key || !asset.id || !asset.item_id || !asset.mime_type || !asset.sha256
      || !new RegExp(`^communications/${asset.item_id}/assets/[0-9a-f-]{36}\\.[a-z0-9]{2,5}$`).test(asset.object_key)) return json({ error: "asset_not_available" }, 404);
    const object = await env.R2_BUCKET.get(asset.object_key);
    if (!object) return json({ error: "asset_file_missing" }, 404);
    if (object.size !== asset.size_bytes || object.customMetadata?.module !== "communications" || object.customMetadata?.itemId !== asset.item_id || object.customMetadata?.sha256 !== asset.sha256) return json({ error: "asset_integrity_mismatch" }, 409);
    return new Response(object.body, { headers: { "content-type": asset.mime_type, "content-length": String(object.size), "content-disposition": `${asset.mime_type.startsWith("image/") || asset.mime_type === "video/mp4" ? "inline" : "attachment"}; filename="${safeFilename(asset.filename || "archivo")}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", vary: "Authorization" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "communications_asset_download_failed";
    if (message === "unauthorized") return json({ error: "unauthorized" }, 401);
    if (message.toLocaleLowerCase().includes("sin permisos")) return json({ error: "forbidden" }, 403);
    if (message === "runtime_not_configured") return json({ error: "storage_runtime_not_configured" }, 503);
    return json({ error: "communications_asset_download_failed" }, 500);
  }
}

export const onRequest: PagesFunction<CommunicationsAssetEnv> = async ({ request, env }) => {
  if (request.method === "POST") return upload(request, env);
  if (request.method === "GET") return download(request, env);
  return json({ error: "method_not_allowed" }, 405);
};
