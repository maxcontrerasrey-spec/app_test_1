interface TelemetryR2Bucket {
  head: (key: string) => Promise<unknown | null>;
  put: (
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }
  ) => Promise<unknown>;
}

interface AtlasTelemetryEnv {
  ATLAS_TRACKTEC_INGEST_TOKEN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  R2_BUCKET?: TelemetryR2Bucket;
}

type NormalizedPosition = {
  external_event_id: string;
  external_vehicle_id: string;
  observed_at: string;
  latitude: number;
  longitude: number;
  speed_kph: number | null;
  heading_degrees: number | null;
  ignition: boolean | null;
  odometer_km: number | null;
  accuracy_m: number | null;
  event_type: string | null;
};

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_EVENTS_PER_BATCH = 1000;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function sameSecret(provided: string, expected: string) {
  const length = Math.max(provided.length, expected.length);
  let difference = provided.length ^ expected.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (provided.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function boundedText(value: unknown, field: string, maxLength = 200) {
  if (typeof value !== "string") throw new Error(`invalid_${field}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`invalid_${field}`);
  return normalized;
}

function nullableNumber(value: unknown, field: string, minimum: number, maximum: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`invalid_${field}`);
  return parsed;
}

function requiredNumber(value: unknown, field: string, minimum: number, maximum: number) {
  const parsed = nullableNumber(value, field, minimum, maximum);
  if (parsed === null) throw new Error(`invalid_${field}`);
  return parsed;
}

function normalizePosition(value: unknown): NormalizedPosition {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_event");
  const row = value as Record<string, unknown>;
  const observedAt = boundedText(row.observed_at, "observed_at", 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i.test(observedAt)) {
    throw new Error("invalid_observed_at");
  }
  const observedDate = new Date(observedAt);
  if (!Number.isFinite(observedDate.getTime())) throw new Error("invalid_observed_at");
  if (observedDate.getTime() > Date.now() + 5 * 60 * 1000) throw new Error("future_observed_at");

  const ignition = row.ignition === undefined || row.ignition === null ? null : row.ignition;
  if (ignition !== null && typeof ignition !== "boolean") throw new Error("invalid_ignition");

  const eventType = row.event_type === undefined || row.event_type === null || row.event_type === ""
    ? null
    : boundedText(row.event_type, "event_type", 64);

  return {
    external_event_id: boundedText(row.external_event_id, "external_event_id"),
    external_vehicle_id: boundedText(row.external_vehicle_id, "external_vehicle_id"),
    observed_at: observedDate.toISOString(),
    latitude: requiredNumber(row.latitude, "latitude", -90, 90),
    longitude: requiredNumber(row.longitude, "longitude", -180, 180),
    speed_kph: nullableNumber(row.speed_kph, "speed_kph", 0, 350),
    heading_degrees: nullableNumber(row.heading_degrees, "heading_degrees", 0, 360),
    ignition,
    odometer_km: nullableNumber(row.odometer_km, "odometer_km", 0, Number.MAX_SAFE_INTEGER),
    accuracy_m: nullableNumber(row.accuracy_m, "accuracy_m", 0, 100000),
    event_type: eventType
  };
}

async function sha256Hex(value: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function rpc(env: AtlasTelemetryEnv, name: string, body: Record<string, unknown>) {
  const baseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!baseUrl || !serviceKey) throw new Error("telemetry_backend_unavailable");

  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error("telemetry_backend_unavailable");
  return response.json().catch(() => null) as Promise<unknown>;
}

export const onRequest: PagesFunction<AtlasTelemetryEnv> = async ({ request, env }) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!env.ATLAS_TRACKTEC_INGEST_TOKEN || env.ATLAS_TRACKTEC_INGEST_TOKEN.trim().length < 32
    || !env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !env.R2_BUCKET) {
    return json({ error: "telemetry_ingest_not_configured" }, 503);
  }

  const providedToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (!providedToken || !sameSecret(providedToken, env.ATLAS_TRACKTEC_INGEST_TOKEN.trim())) {
    return json({ error: "unauthorized" }, 401);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
    let body: { events?: unknown };
    try {
      body = JSON.parse(rawBody) as { events?: unknown };
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > MAX_EVENTS_PER_BATCH) {
      return json({ error: "invalid_batch_size", max_events: MAX_EVENTS_PER_BATCH }, 400);
    }

    const normalized = body.events.map(normalizePosition);
    const eventIds = new Map<string, NormalizedPosition>();
    for (const position of normalized) {
      const previous = eventIds.get(position.external_event_id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(position)) {
        return json({ error: "conflicting_external_event_id" }, 400);
      }
      eventIds.set(position.external_event_id, position);
    }
    const positions = [...eventIds.values()]
      .sort((left, right) => left.observed_at.localeCompare(right.observed_at)
        || left.external_vehicle_id.localeCompare(right.external_vehicle_id)
        || left.external_event_id.localeCompare(right.external_event_id));
    const jsonl = positions.map((position) => JSON.stringify(position)).join("\n") + "\n";
    const content = new TextEncoder().encode(jsonl);
    const digest = await sha256Hex(content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength));
    const firstObservedAt = positions[0].observed_at;
    const date = firstObservedAt.slice(0, 10).replaceAll("-", "/");
    const objectKey = `atlas-operations/telemetry/v1/${date}/${digest}.jsonl.gz`;
    const existingObject = await env.R2_BUCKET.head(objectKey);

    if (!existingObject) {
      const compressedStream = new Blob([content]).stream().pipeThrough(new CompressionStream("gzip"));
      const compressed = await new Response(compressedStream).arrayBuffer();
      await env.R2_BUCKET.put(objectKey, compressed, {
        httpMetadata: { contentType: "application/gzip", contentDisposition: "attachment" },
        customMetadata: { module: "atlas-operations", format: "jsonl-v1", sha256: digest, eventCount: String(positions.length) }
      });
    }

    const ingestResult = await rpc(env, "atlas_ops_ingest_tracktec_positions", {
      p_events: positions,
      p_archive_reference: objectKey,
      p_payload_digest: digest
    });
    await rpc(env, "atlas_ops_purge_archived_telemetry", {
      p_external_event_ids: [...new Set(positions.map((position) => position.external_event_id))],
      p_archive_reference: objectKey
    });

    const result = ingestResult && typeof ingestResult === "object" ? ingestResult as Record<string, unknown> : {};
    return json({
      accepted: positions.length,
      inserted: Number(result.inserted ?? 0),
      unmatched: Number(result.unmatched ?? 0),
      archive: "stored",
      archive_reference: objectKey
    }, 202);
  } catch (error) {
    const code = error instanceof Error ? error.message : "telemetry_ingest_failed";
    const status = code.startsWith("invalid_") || code === "future_observed_at" ? 400 : 503;
    return json({ error: status === 400 ? code : "telemetry_ingest_unavailable" }, status);
  }
};
