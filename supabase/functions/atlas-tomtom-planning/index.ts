import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { optimizeOpenRoute } from "./openRouteOptimizer.ts";
import { buildMatrixBlocks } from "./matrixBlocks.ts";
import { buildRouteSegments } from "./routeSegments.ts";

const ALLOWED_ORIGINS = new Set([
  "https://gestion.busesjm.cl",
  "http://127.0.0.1:5173",
  "http://localhost:5173"
]);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_STOPS = 151;
const MATRIX_BLOCK_SIZE = 10;
const ROUTE_MAX_LOCATIONS = 10;
const VALHALLA = "https://valhalla1.openstreetmap.de";
const CALAMA = { longitude: -68.9294, latitude: -22.4544 };

type Point = { lat: number; lng: number };

function response(body: unknown, status: number, origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://gestion.busesjm.cl";
  // Fetch forbids a response body for 204/205/304. In particular, browsers
  // preflight cross-origin TomTom requests with OPTIONS and require a valid 204.
  const responseBody = status === 204 || status === 205 || status === 304 ? null : JSON.stringify(body);
  const headers = new Headers({
    "cache-control": "no-store",
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "Origin"
  });
  if (responseBody !== null) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(responseBody, {
    status,
    headers
  });
}

function text(value: unknown, maxLength: number, field: string) {
  if (typeof value !== "string") throw new Error(`invalid_${field}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`invalid_${field}`);
  return normalized;
}

function point(value: unknown): Point {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_point");
  const row = value as Record<string, unknown>;
  const lat = typeof row.lat === "number" ? row.lat : Number(row.lat);
  const lng = typeof row.lng === "number" ? row.lng : Number(row.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("invalid_point");
  }
  return { lat, lng };
}

async function valhallaMatrix(sites: Point[]) {
  const matrix = Array.from({ length: sites.length }, () => Array<number>(sites.length).fill(Number.POSITIVE_INFINITY));
  const blocks = buildMatrixBlocks(sites.length, MATRIX_BLOCK_SIZE);
  for (let offset = 0; offset < blocks.length; offset += 3) {
    // Execute a small number of matrix blocks concurrently, keeping requests bounded.
    const selected = blocks.slice(offset, offset + 3);
    await Promise.all(selected.map(async ({ row, col }) => {
      const sources = sites.slice(row, Math.min(row + MATRIX_BLOCK_SIZE, sites.length)).map(({ lat, lng }) => ({ lat, lon: lng }));
      const targets = sites.slice(col, Math.min(col + MATRIX_BLOCK_SIZE, sites.length)).map(({ lat, lng }) => ({ lat, lon: lng }));
      const query = new URLSearchParams({ json: JSON.stringify({ sources, targets, costing: "auto", costing_options: { auto: { use_ferry: 0, use_tolls: 0.5 } }, units: "kilometers", verbose: false }) });
      const response = await fetch(`${VALHALLA}/sources_to_targets?${query}`, { signal: AbortSignal.timeout(18_000) });
      if (!response.ok) throw new Error(`valhalla_matrix_http_${response.status}`);
      const payload = await response.json() as { sources_to_targets?: { durations?: unknown } };
      const durations = payload.sources_to_targets?.durations;
      if (!Array.isArray(durations) || durations.length !== sources.length) throw new Error("valhalla_matrix_invalid_response");
      durations.forEach((line, rowOffset) => {
        if (!Array.isArray(line) || line.length !== targets.length) throw new Error("valhalla_matrix_invalid_response");
        line.forEach((value, colOffset) => {
          if (typeof value === "number" && Number.isFinite(value) && value >= 0) matrix[row + rowOffset]![col + colOffset] = value;
        });
      });
    }));
  }
  return matrix;
}

function decodePolyline6(value: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < value.length) {
    const read = () => {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        if (index >= value.length || shift > 30) throw new Error("valhalla_route_invalid_geometry");
        byte = value.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    latitude += read();
    longitude += read();
    coordinates.push([longitude / 1e6, latitude / 1e6]);
  }
  return coordinates;
}

async function valhallaRouteSegment(sites: Point[]) {
  const routeResponse = await fetch(`${VALHALLA}/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locations: sites.map(({ lat, lng }) => ({ lat, lon: lng })), costing: "auto", costing_options: { auto: { use_ferry: 0, use_tolls: 0.5 } }, units: "kilometers", shape_format: "polyline6" }),
    signal: AbortSignal.timeout(18_000)
  });
  if (!routeResponse.ok) throw new Error(`valhalla_route_http_${routeResponse.status}`);
  const payload = await routeResponse.json() as { trip?: { status?: number; summary?: { length?: number; time?: number }; legs?: Array<{ shape?: string }> } };
  const summary = payload.trip?.summary;
  const coordinates = (payload.trip?.legs ?? []).flatMap((leg) => typeof leg.shape === "string" ? decodePolyline6(leg.shape) : []);
  const deduplicated = coordinates.filter((coordinate, index) => index === 0 || coordinate[0] !== coordinates[index - 1]![0] || coordinate[1] !== coordinates[index - 1]![1]);
  if (payload.trip?.status !== 0 || typeof summary?.length !== "number" || typeof summary.time !== "number" || deduplicated.length < 2 || !Number.isFinite(summary.length) || !Number.isFinite(summary.time)) {
    throw new Error("valhalla_route_not_returned");
  }
  return { coordinates: deduplicated, distanceMeters: Math.round(summary.length * 1000), durationSeconds: Math.round(summary.time), provider: "valhalla" as const, travelMode: "auto" as const };
}

async function valhallaRoute(sites: Point[]) {
  const segments = buildRouteSegments(sites.length, ROUTE_MAX_LOCATIONS);
  const results: Array<Awaited<ReturnType<typeof valhallaRouteSegment>>> = Array(segments.length);
  for (let offset = 0; offset < segments.length; offset += 3) {
    await Promise.all(segments.slice(offset, offset + 3).map(async (segment, segmentOffset) => {
      results[offset + segmentOffset] = await valhallaRouteSegment(sites.slice(segment.start, segment.end));
    }));
  }
  const complete = results.filter((result): result is Awaited<ReturnType<typeof valhallaRouteSegment>> => Boolean(result));
  const coordinates = complete.flatMap((result, index) => index === 0 ? result.coordinates : result.coordinates.slice(1));
  return {
    coordinates,
    distanceMeters: complete.reduce((total, result) => total + result.distanceMeters, 0),
    durationSeconds: complete.reduce((total, result) => total + result.durationSeconds, 0),
    provider: "valhalla" as const,
    travelMode: "auto" as const
  };
}

async function isActiveSuperAdmin(accessToken: string, apiKey: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl || !apiKey) throw new Error("auth_config_missing");

  // Use the caller's JWT and public API key so Postgres evaluates auth.uid()
  // with the same identity and canonical guard used by Atlas RLS and RPCs.
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/atlas_ops_is_current_super_admin`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: "{}",
    signal: AbortSignal.timeout(5_000)
  });
  if (!profileResponse.ok) throw new Error("superadmin_check_failed");
  const allowed = await profileResponse.json() as unknown;
  if (typeof allowed !== "boolean") throw new Error("superadmin_check_invalid_response");
  return allowed;
}

async function callTomTom(path: string, body: Record<string, unknown>, sessionId?: string) {
  const apiKey = Deno.env.get("TOMTOM_API_KEY");
  if (!apiKey) throw new Error("tomtom_not_configured");
  const headers = new Headers({
    "content-type": "application/json",
    "TomTom-Api-Key": apiKey,
    "TomTom-Api-Version": "3",
      "Attributes": path.endsWith("/suggest") || path.endsWith("/discover")
        ? "results(id,type,title,subtitles)"
        : "routes",
    "Accept-Language": "es-CL"
  });
  if (sessionId) headers.set("Session-Id", sessionId);
  const result = await fetch(`https://api.tomtom.com${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000)
  });
  if (!result.ok) {
    if (result.status === 429) throw new Error("tomtom_rate_limited");
    if (result.status === 403) throw new Error("tomtom_key_or_plan_rejected");
    if (result.status === 400 && path.includes("/routing/routes/calculate")) {
      const errorBody = await result.json().catch(() => null) as { detailedError?: { code?: unknown } } | null;
      const providerCode = typeof errorBody?.detailedError?.code === "string" ? errorBody.detailedError.code : "";
      if (providerCode === "MAP_MATCHING_FAILURE") throw new Error("tomtom_route_point_not_routable");
      if (providerCode === "NO_ROUTE_FOUND") throw new Error("tomtom_route_not_found");
      if (providerCode === "BAD_INPUT") throw new Error("tomtom_route_bad_input");
    }
    throw new Error(`tomtom_http_${result.status}`);
  }
  return await result.json() as Record<string, unknown>;
}

function normalizeSearchResult(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const position = row.position as { coordinates?: unknown } | undefined;
  const coords = position?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const title = typeof row.title === "string" ? row.title : "";
  const subtitles = Array.isArray(row.subtitles) ? row.subtitles.filter((value): value is string => typeof value === "string") : [];
  const address = row.address && typeof row.address === "object" ? row.address as Record<string, unknown> : {};
  const details = [address.street, address.houseNumber].filter((value): value is string => typeof value === "string");
  const place = [address.municipality, address.countrySubdivision].filter((value): value is string => typeof value === "string");
  const label = [...new Set([title, ...details, ...subtitles, ...place])].join(", ").slice(0, 240);
  if (!label) return null;
  return { id: typeof row.id === "string" ? row.id : null, type: typeof row.type === "string" ? row.type : null, label, lat, lng };
}

function normalizeSuggestion(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const allowedTypes = new Set(["address", "street", "intersection"]);
  const type = typeof row.type === "string" && allowedTypes.has(row.type) ? row.type : null;
  const id = typeof row.id === "string" ? row.id : null;
  if (!type || !id) return null;
  const title = typeof row.title === "string" ? row.title : "";
  const subtitles = Array.isArray(row.subtitles) ? row.subtitles.filter((value): value is string => typeof value === "string") : [];
  const label = [title, ...subtitles].filter(Boolean).join(", ").slice(0, 240);
  return label ? { id, type, label } : null;
}

async function getTomTomDetails(type: string, id: string, sessionId: string) {
  const apiKey = Deno.env.get("TOMTOM_API_KEY");
  if (!apiKey) throw new Error("tomtom_not_configured");
  const typePath: Record<string, string> = { address: "addresses", street: "streets", intersection: "intersections" };
  const pluralType = typePath[type];
  if (!pluralType) throw new Error("invalid_place_type");
  const url = `https://api.tomtom.com/maps/orbis/places/details/${pluralType}/${encodeURIComponent(id)}`;
  const result = await fetch(url, {
    headers: {
      "TomTom-Api-Key": apiKey,
      "TomTom-Api-Version": "3",
      "Attributes": "id,type,title,subtitles,position,address",
      "Accept-Language": "es-CL",
      "Session-Id": sessionId
    },
    signal: AbortSignal.timeout(12_000)
  });
  if (!result.ok) {
    if (result.status === 429) throw new Error("tomtom_rate_limited");
    if (result.status === 403) throw new Error("tomtom_key_or_plan_rejected");
    throw new Error(`tomtom_http_${result.status}`);
  }
  return await result.json() as Record<string, unknown>;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return response({}, 204, origin);
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return response({ error: "origin_not_allowed" }, 403, origin);

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return response({ error: "unauthorized" }, 401, origin);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return response({ error: "request_too_large" }, 413, origin);

  try {
    if (!await isActiveSuperAdmin(token, request.headers.get("apikey"))) return response({ error: "superadmin_only" }, 403, origin);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return response({ error: "request_too_large" }, 413, origin);
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const action = payload.action;
    if (action === "suggest" || action === "discover") {
      const query = text(payload.query, 120, "query");
      if (query.length < 3) return response({ suggestions: [] }, 200, origin);
      const sessionId = text(payload.sessionId, 36, "session_id");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
        return response({ error: "invalid_session_id" }, 400, origin);
      }
      const body = {
        query,
        maxResults: 6,
        origin: { type: "point", coordinates: [CALAMA.longitude, CALAMA.latitude] },
        preferences: { geometry: { type: "point", coordinates: [CALAMA.longitude, CALAMA.latitude] } },
        filters: { types: ["address", "street", "intersection"], countryCodesIso2: ["CL"] }
      };
      const responseBody = await callTomTom(`/maps/orbis/places/${action}`, body, sessionId);
      const items = Array.isArray(responseBody.results) ? responseBody.results : [];
      return response({ suggestions: items.map(normalizeSuggestion).filter(Boolean) }, 200, origin);
    }
    if (action === "details") {
      const type = text(payload.type, 24, "type");
      const id = text(payload.id, 160, "id");
      const sessionId = text(payload.sessionId, 36, "session_id");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
        return response({ error: "invalid_session_id" }, 400, origin);
      }
      const detail = await getTomTomDetails(type, id, sessionId);
      const suggestion = normalizeSearchResult(detail);
      if (!suggestion) return response({ error: "place_coordinates_missing" }, 422, origin);
      return response({ suggestion }, 200, origin);
    }
    if (action === "optimize") {
      if (!Array.isArray(payload.stops) || payload.stops.length < 2 || payload.stops.length > MAX_STOPS) {
        return response({ error: "route_requires_2_to_151_stops" }, 400, origin);
      }
      const stops = payload.stops.map(point);
      const fixedDestinationIndex = payload.fixedDestinationIndex;
      if (fixedDestinationIndex !== undefined && (!Number.isInteger(fixedDestinationIndex) || (fixedDestinationIndex as number) <= 0 || (fixedDestinationIndex as number) >= stops.length)) {
        return response({ error: "invalid_fixed_destination_index" }, 400, origin);
      }
      const matrix = await valhallaMatrix(stops);
      const optimized = optimizeOpenRoute(matrix, undefined, fixedDestinationIndex as number | undefined);
      const orderedStops = optimized.order.map((index) => stops[index]!);
      const route = await valhallaRoute(orderedStops);
      return response({ ...route, order: optimized.order, matrixDurationSeconds: optimized.durationSeconds, inputOrderMatrixDurationSeconds: optimized.inputOrderDurationSeconds, optimizationMethod: "valhalla_matrix_open_path_v1" }, 200, origin);
    }
    if (action === "route") {
      if (!Array.isArray(payload.stops) || payload.stops.length < 2 || payload.stops.length > MAX_STOPS) {
        return response({ error: "route_requires_2_to_151_stops" }, 400, origin);
      }
      return response(await valhallaRoute(payload.stops.map(point)), 200, origin);
    }
    return response({ error: "unsupported_action" }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "request_failed";
    const status = message === "tomtom_not_configured" || message.startsWith("superadmin_check_") || message === "auth_config_missing"
      ? 503
      : message === "tomtom_rate_limited" ? 429
      : message.startsWith("valhalla_") ? 502
      : 400;
    return response({ error: message }, status, origin);
  }
});
