import type { Route } from "@stadiamaps/ferrostar";

const DEFAULT_SIMULATION_ERROR = "No fue posible iniciar la simulación del conductor.";
export const VALHALLA_ROUTE_MAX_LOCATIONS = 10;

/** Valhalla's /route endpoint accepts at most ten locations per request. */
export function splitRouteStops<T>(stops: T[], maxLocations = VALHALLA_ROUTE_MAX_LOCATIONS): T[][] {
  if (!Number.isInteger(maxLocations) || maxLocations < 2) throw new Error("El tramo debe permitir al menos dos ubicaciones.");
  if (stops.length < 2) throw new Error("La navegación requiere al menos dos ubicaciones.");

  const segments: T[][] = [];
  for (let start = 0; start < stops.length - 1; start += maxLocations - 1) {
    segments.push(stops.slice(start, start + maxLocations));
  }
  return segments;
}

function sameCoordinate(a: Route["geometry"][number], b: Route["geometry"][number]) {
  return Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;
}

/** Joins overlapping Valhalla/Ferrostar segments into one continuous navigation route. */
export function mergeFerrostarRouteSegments(routes: Route[]): Route {
  if (!routes.length) throw new Error("Valhalla no devolvió una ruta para estas paradas.");
  if (routes.length === 1) return routes[0]!;

  const geometry: Route["geometry"] = [];
  const waypoints: Route["waypoints"] = [];
  const steps: Route["steps"] = [];
  let distance = 0;
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;

  for (const route of routes) {
    const startsAtPreviousEnd = geometry.length > 0 && route.geometry.length > 0 && sameCoordinate(geometry[geometry.length - 1]!, route.geometry[0]!);
    geometry.push(...(startsAtPreviousEnd ? route.geometry.slice(1) : route.geometry));
    waypoints.push(...(waypoints.length > 0 ? route.waypoints.slice(1) : route.waypoints));
    steps.push(...route.steps);
    distance += route.distance;
    south = Math.min(south, route.bbox.sw.lat);
    west = Math.min(west, route.bbox.sw.lng);
    north = Math.max(north, route.bbox.ne.lat);
    east = Math.max(east, route.bbox.ne.lng);
  }

  return { geometry, waypoints, steps, distance, bbox: { sw: { lat: south, lng: west }, ne: { lat: north, lng: east } } };
}

/** Keeps useful provider/WASM errors visible even when Ferrostar rejects with a string or object. */
export function formatDriverSimulationError(reason: unknown): string {
  let message = "";
  if (reason instanceof Error) message = reason.message;
  else if (typeof reason === "string") message = reason;
  else if (reason && typeof reason === "object") {
    const candidate = reason as { message?: unknown; error?: unknown; code?: unknown };
    const detail = [candidate.message, candidate.error, candidate.code].find((value) => typeof value === "string" && value.trim());
    if (typeof detail === "string") message = detail;
  }

  const normalized = message.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
  return normalized || DEFAULT_SIMULATION_ERROR;
}
