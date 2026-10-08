import type { Route } from "@stadiamaps/ferrostar";
import type { AtlasPlannedRoute, AtlasRouteManeuver } from "../services/atlasOperationsApi";

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

function routeBearing(from: Route["geometry"][number] | undefined, to: Route["geometry"][number] | undefined) {
  if (!from || !to || (from.lat === to.lat && from.lng === to.lng)) return null;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const toDegrees = (radians: number) => radians * 180 / Math.PI;
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRadians(to.lat));
  const x = Math.cos(toRadians(from.lat)) * Math.sin(toRadians(to.lat))
    - Math.sin(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function classifyRouteStep(step: Route["steps"][number]): AtlasRouteManeuver["maneuverType"] {
  const content = (step.visualInstructions ?? []).flatMap(({ primaryContent, secondaryContent, subContent }) => [primaryContent, secondaryContent, subContent])
    .find((item) => item?.maneuverType || item?.maneuverModifier);
  const modifier = content?.maneuverModifier;
  if (modifier === "uturn") return "UTURN";
  if (content?.maneuverType === "roundabout" || content?.maneuverType === "rotary" || content?.maneuverType === "roundabout turn" || content?.maneuverType === "exit roundabout" || content?.maneuverType === "exit rotary") return "ROUNDABOUT";
  if (content?.maneuverType === "merge") return "MERGE";
  if (content?.maneuverType === "off ramp" || content?.maneuverType === "on ramp") return "EXIT";
  if (modifier?.includes("right")) return "RIGHT";
  if (modifier?.includes("left")) return "LEFT";
  if (modifier === "straight" || content?.maneuverType === "continue" || content?.maneuverType === "depart" || content?.maneuverType === "arrive" || content?.maneuverType === "new name") return "STRAIGHT";
  return "OTHER";
}

/** Maps the exact route returned for the driver simulation into the bounded, evidence-labeled AI audit contract. */
export function toAtlasPlannedRoute(route: Route, reference: AtlasPlannedRoute, stopCount: number): AtlasPlannedRoute {
  const stopGeometryIndexes: number[] = [];
  let searchFrom = 0;
  for (const waypoint of route.waypoints) {
    let closestIndex = searchFrom;
    let closestDistance = Infinity;
    for (let index = searchFrom; index < route.geometry.length; index += 1) {
      const point = route.geometry[index]!;
      const distance = Math.hypot(point.lat - waypoint.coordinate.lat, point.lng - waypoint.coordinate.lng);
      if (distance < closestDistance) { closestDistance = distance; closestIndex = index; }
    }
    stopGeometryIndexes.push(closestIndex);
    searchFrom = closestIndex;
  }
  const legForStep = (stepIndex: number) => {
    const step = route.steps[stepIndex]!;
    const coordinate = step.geometry[0];
    if (!coordinate || stopGeometryIndexes.length !== stopCount || stopCount < 2) return null;
    const isArrival = (step.visualInstructions ?? []).some(({ primaryContent, secondaryContent, subContent }) =>
      [primaryContent, secondaryContent, subContent].some((item) => item?.maneuverType === "arrive")
    );
    let routeIndex = 0;
    let closestDistance = Infinity;
    route.geometry.forEach((point, index) => {
      if (index < (stopGeometryIndexes[0] ?? 0)) return;
      const distance = Math.hypot(point.lat - coordinate.lat, point.lng - coordinate.lng);
      if (distance < closestDistance) { closestDistance = distance; routeIndex = index; }
    });
    if (isArrival) {
      let arrivedAt = -1;
      let waypointDistance = Infinity;
      stopGeometryIndexes.forEach((index, stopIndex) => {
        if (stopIndex === 0) return;
        const distance = Math.abs(index - routeIndex);
        if (distance < waypointDistance) { waypointDistance = distance; arrivedAt = stopIndex; }
      });
      if (arrivedAt > 0 && waypointDistance <= 1) return arrivedAt - 1;
    }
    let legIndex = 0;
    for (let index = 1; index < stopGeometryIndexes.length - 1; index += 1) {
      if (routeIndex >= stopGeometryIndexes[index]!) legIndex = index;
    }
    return legIndex;
  };
  const maneuvers: AtlasRouteManeuver[] = route.steps.map((step, index) => {
    const previous = route.steps[index - 1];
    const previousGeometry = previous?.geometry ?? [];
    const inboundHeading = routeBearing(previousGeometry[previousGeometry.length - 2], previousGeometry[previousGeometry.length - 1]);
    const outboundHeading = routeBearing(step.geometry[0], step.geometry[1]);
    let turnAngleDeg: number | null = null;
    if (inboundHeading !== null && outboundHeading !== null) {
      const delta = (outboundHeading - inboundHeading + 540) % 360 - 180;
      turnAngleDeg = Math.round(delta);
    }
    const maneuverType = classifyRouteStep(step);
    const sourceEvidence = ["VALHALLA_MANEUVER_TYPE"];
    if (inboundHeading !== null && outboundHeading !== null) sourceEvidence.push("VALHALLA_BEARING_BEFORE_AFTER");
    if (step.geometry[0]) sourceEvidence.push("VALHALLA_ROUTE_SHAPE_INDEX");
    if (step.roadName) sourceEvidence.push("VALHALLA_STREET_NAMES");
    const geometryEvidence = [sourceEvidence.includes("VALHALLA_MANEUVER_TYPE"), inboundHeading !== null && outboundHeading !== null, Boolean(step.geometry[0])].filter(Boolean).length;
    const routeLegIndex = legForStep(index);
    return {
      maneuverId: `m-${String(index + 1).padStart(3, "0")}`,
      latitude: step.geometry[0]?.lat ?? null,
      longitude: step.geometry[0]?.lng ?? null,
      maneuverType,
      instruction: step.instruction.slice(0, 180),
      roadNames: step.roadName ? [step.roadName.slice(0, 100)] : [],
      turnAngleDeg,
      inboundHeading,
      outboundHeading,
      roadClassFrom: null,
      roadClassTo: null,
      lanesFrom: null,
      lanesTo: null,
      oneWay: null,
      estimatedRoadWidthM: null,
      trafficLevel: "UNKNOWN",
      knownRestrictionCount: null,
      geometryConfidence: Number((geometryEvidence / 3).toFixed(2)),
      sourceEvidence,
      routeLegIndex,
      legDestinationStopIndex: routeLegIndex === null ? null : routeLegIndex + 1,
      legDestinationIsFinal: routeLegIndex === null ? null : routeLegIndex === stopCount - 2
    };
  });
  const turnCount = maneuvers.filter(({ maneuverType }) => maneuverType === "LEFT" || maneuverType === "RIGHT" || maneuverType === "UTURN").length;
  return {
    ...reference,
    coordinates: route.geometry.map(({ lat, lng }) => [lng, lat]),
    distanceMeters: route.distance,
    durationSeconds: route.steps.reduce((total, step) => total + step.duration, 0),
    provider: "valhalla",
    travelMode: "bus",
    uturnCount: maneuvers.filter(({ maneuverType }) => maneuverType === "UTURN").length,
    turnCount,
    maneuvers
  };
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
