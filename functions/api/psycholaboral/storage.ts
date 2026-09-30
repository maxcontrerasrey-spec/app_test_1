interface PsycholaboralStorageEnv {
  R2_BUCKET?: {
    get: (key: string) => Promise<{
      body: ReadableStream<Uint8Array>;
      size: number;
      httpMetadata?: { contentType?: string; contentDisposition?: string };
      customMetadata?: Record<string, string>;
    } | null>;
    head: (key: string) => Promise<{ customMetadata?: Record<string, string> } | null>;
    put: (
      key: string,
      value: ArrayBuffer,
      options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> },
    ) => Promise<unknown>;
  };
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  PSYCHOLABORAL_R2_HMAC_SECRET?: string;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const PATH = "/api/psycholaboral/storage";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isKind(value: string): value is "certificate" | "integrated_report" {
  return value === "certificate" || value === "integrated_report";
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function bearer(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

async function authorizedArtifact(env: PsycholaboralStorageEnv, token: string, assessmentId: string, kind: "certificate" | "integrated_report") {
  const baseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  if (!baseUrl || !anonKey) throw new Error("storage_runtime_not_configured");
  const userResponse = await fetch(`${baseUrl}/auth/v1/user`, { headers: { apikey: anonKey, authorization: `Bearer ${token}` } });
  if (!userResponse.ok) throw new Error("unauthorized");
  const rpcName = kind === "certificate" ? "get_psycholaboral_certificate_artifact" : "get_psycholaboral_report_artifact";
  const rpcResponse = await fetch(`${baseUrl}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers: { apikey: anonKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ p_assessment_id: assessmentId }),
  });
  if (!rpcResponse.ok) {
    const error = await rpcResponse.json().catch(() => null) as { message?: string } | null;
    throw new Error(error?.message || "artifact_not_available");
  }
  return await rpcResponse.json() as { bucket?: string; path?: string; sha256?: string; storage_provider?: string };
}

async function handleUpload(request: Request, env: PsycholaboralStorageEnv) {
  const secret = env.PSYCHOLABORAL_R2_HMAC_SECRET?.trim();
  if (!secret || secret.length < 32) return json({ error: "r2_gateway_not_configured" }, 503);
  if (!env.R2_BUCKET) return json({ error: "r2_not_configured" }, 503);
  const assessmentId = request.headers.get("x-psych-assessment-id")?.trim() || "";
  const kind = request.headers.get("x-psych-artifact-kind")?.trim() || "";
  const expectedHash = request.headers.get("x-psych-content-sha256")?.trim().toLowerCase() || "";
  const timestamp = request.headers.get("x-psych-timestamp")?.trim() || "";
  const nonce = request.headers.get("x-psych-nonce")?.trim() || "";
  const signature = request.headers.get("x-psych-signature")?.trim().toLowerCase() || "";
  if (!isUuid(assessmentId) || !isKind(kind) || !/^[a-f0-9]{64}$/.test(expectedHash) || !/^[a-f0-9]{16,128}$/.test(nonce)) {
    return json({ error: "invalid_upload_metadata" }, 400);
  }
  const timestampMs = Number(timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return json({ error: "expired_request" }, 401);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength < 8 || bytes.byteLength > MAX_PDF_BYTES) return json({ error: "invalid_pdf_size" }, 413);
  const view = new Uint8Array(bytes);
  if (view[0] !== 0x25 || view[1] !== 0x50 || view[2] !== 0x44 || view[3] !== 0x46 || view[4] !== 0x2d) return json({ error: "invalid_pdf_signature" }, 415);
  const actualHash = await sha256(bytes);
  if (!safeEqual(actualHash, expectedHash)) return json({ error: "content_hash_mismatch" }, 400);
  const canonical = ["POST", PATH, timestamp, nonce, actualHash].join("\n");
  const expectedSignature = await hmac(secret, canonical);
  if (!/^[a-f0-9]{64}$/.test(signature) || !safeEqual(signature, expectedSignature)) return json({ error: "unauthorized" }, 401);

  const objectKey = `psycholaboral/${assessmentId}/${kind}/${actualHash}.pdf`;
  const existing = await env.R2_BUCKET.head(objectKey);
  if (existing && existing.customMetadata?.sha256 !== actualHash) return json({ error: "object_conflict" }, 409);
  if (!existing) {
    await env.R2_BUCKET.put(objectKey, bytes, {
      httpMetadata: { contentType: "application/pdf", cacheControl: "private, no-store" },
      customMetadata: { module: "psycholaboral", assessmentId, artifactKind: kind, sha256: actualHash, schemaVersion: "1" },
    });
  }
  return json({ stored: true, objectKey, sha256: actualHash });
}

export const onRequest = async ({ request, env }: { request: Request; env: PsycholaboralStorageEnv }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "https://gestion.busesjm.cl", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS" } });
  if (request.method === "POST") return handleUpload(request, env);
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!env.R2_BUCKET) return json({ error: "r2_not_configured" }, 503);
  const token = bearer(request);
  if (!token) return json({ error: "unauthorized" }, 401);
  const url = new URL(request.url);
  const assessmentId = url.searchParams.get("assessment_id")?.trim() || "";
  const kind = url.searchParams.get("kind")?.trim() || "";
  if (!isUuid(assessmentId) || !isKind(kind)) return json({ error: "invalid_artifact_reference" }, 400);
  try {
    const artifact = await authorizedArtifact(env, token, assessmentId, kind);
    if (artifact.storage_provider !== "cloudflare_r2" || artifact.bucket !== "cloudflare_r2" || !artifact.path?.startsWith(`psycholaboral/${assessmentId}/${kind}/`)) {
      return json({ error: "artifact_not_stored_in_r2" }, 404);
    }
    const object = await env.R2_BUCKET.get(artifact.path);
    if (!object) return json({ error: "artifact_missing" }, 404);
    if (!artifact.sha256 || object.customMetadata?.sha256 !== artifact.sha256) return json({ error: "artifact_integrity_mismatch" }, 409);
    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType || "application/pdf",
        "content-length": String(object.size),
        "content-disposition": `inline; filename="psycholaboral-${kind}.pdf"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        vary: "Authorization",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "artifact_unavailable";
    const status = message === "unauthorized" ? 401 : message.toLowerCase().includes("sin permisos") ? 403 : 409;
    return json({ error: status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "artifact_unavailable" }, status);
  }
};
