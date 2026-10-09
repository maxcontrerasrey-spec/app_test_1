export const ATLAS_ROUTE_EVIDENCE_VERSION = 1 as const;
export const ATLAS_ROUTE_EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000;
const SIGNING_CONTEXT = "atlas-route-evidence:v1:";

export const ATLAS_ROUTE_KINDS = ["OPTIMIZED_PROPOSAL", "SAVED_ROUTE_PREVIEW", "DRIVER_SIMULATION"] as const;
export type AtlasRouteKind = typeof ATLAS_ROUTE_KINDS[number];

export function parseAtlasRouteKind(value: unknown): AtlasRouteKind | null {
  return typeof value === "string" && (ATLAS_ROUTE_KINDS as readonly string[]).includes(value)
    ? value as AtlasRouteKind
    : null;
}

export type AtlasRouteEvidenceClaims = {
  evidenceVersion: typeof ATLAS_ROUTE_EVIDENCE_VERSION;
  actorUserId: string;
  issuedAtMs: number;
  geometryHash: string;
  routeSnapshot: Record<string, unknown>;
  maneuvers: unknown[];
};

export type AtlasRouteEvidenceProof = Omit<AtlasRouteEvidenceClaims, "maneuvers"> & {
  signature: string;
};

function canonical(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("route_evidence_non_finite_number");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== "object") throw new Error("route_evidence_invalid_value");
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonical(record[key])]));
}

export function canonicalAtlasRouteEvidence(claims: AtlasRouteEvidenceClaims): string {
  return JSON.stringify(canonical(claims));
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(value)) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function toBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function importSigningKey(secret: string) {
  if (secret.trim().length < 32) throw new Error("route_evidence_signing_key_unavailable");
  return await crypto.subtle.importKey("raw", new TextEncoder().encode(`${SIGNING_CONTEXT}${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signAtlasRouteEvidence(claims: AtlasRouteEvidenceClaims, secret: string): Promise<string> {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonicalAtlasRouteEvidence(claims)));
  return toBase64Url(signature);
}

export async function verifyAtlasRouteEvidence(
  claims: AtlasRouteEvidenceClaims,
  signature: string,
  secret: string,
  expectedActorUserId: string,
  nowMs = Date.now()
): Promise<boolean> {
  if (claims.evidenceVersion !== ATLAS_ROUTE_EVIDENCE_VERSION
    || claims.actorUserId !== expectedActorUserId
    || !Number.isSafeInteger(claims.issuedAtMs)
    || claims.issuedAtMs > nowMs + 120_000
    || nowMs - claims.issuedAtMs > ATLAS_ROUTE_EVIDENCE_MAX_AGE_MS
    || !/^[a-f0-9]{64}$/.test(claims.geometryHash)
    || !Array.isArray(claims.maneuvers)
    || !claims.routeSnapshot || typeof claims.routeSnapshot !== "object" || Array.isArray(claims.routeSnapshot)) return false;
  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return false;
  try {
    const key = await importSigningKey(secret);
    const signatureBuffer = new ArrayBuffer(signatureBytes.length);
    new Uint8Array(signatureBuffer).set(signatureBytes);
    return await crypto.subtle.verify("HMAC", key, signatureBuffer, new TextEncoder().encode(canonicalAtlasRouteEvidence(claims)));
  } catch {
    return false;
  }
}

export async function hashAtlasRouteEvidence(claims: AtlasRouteEvidenceClaims): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalAtlasRouteEvidence(claims)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashAtlasRouteGeometry(coordinates: Array<[number, number]>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(coordinates)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getAtlasRouteEvidenceSecret(readEnv: (name: string) => string | undefined): string | null {
  const secretKeys = readEnv("SUPABASE_SECRET_KEYS")?.trim();
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      const defaultKey = parsed.default;
      if (typeof defaultKey === "string" && defaultKey.trim().length >= 32) return defaultKey.trim();
    } catch {
      return null;
    }
  }
  const legacyKey = readEnv("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  return legacyKey && legacyKey.length >= 32 ? legacyKey : null;
}
