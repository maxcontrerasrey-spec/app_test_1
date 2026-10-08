import type { RouteManeuver } from "./routeQuality.ts";
import { countUTurns } from "./routeQuality.ts";

export type AtlasRoutePathLeg = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  uturnCount: number;
  maneuvers: RouteManeuver[];
};

export type RouteAlternativeEvaluation = {
  legs: AtlasRoutePathLeg[];
  uturnsBefore: number;
  uturnsAfter: number;
  addedDistanceMeters: number;
  addedDurationSeconds: number;
  changedLegCount: number;
};

export type ManeuverAvoidanceTarget = { routeLegIndex: number; latitude: number; longitude: number };
export type ManeuverLinearCostFactor = { routeLegIndex: number; shape: string; factor: number };

export const MAX_ALTERNATIVE_LEGS = 4;
export const MAX_ALTERNATES_PER_LEG = 2;
export const MAX_ALTERNATIVE_CONCURRENCY = 2;
export const ALTERNATIVE_REQUEST_TIMEOUT_MS = 7_000;
export const MAX_ALTERNATIVE_EXTRA_DISTANCE_METERS = 500;
export const MAX_ALTERNATIVE_EXTRA_LEG_DURATION_SECONDS = 120;
export const MAX_ALTERNATIVE_EXTRA_LEG_DURATION_RATIO = 0.25;
export const MAX_ALTERNATIVE_EXTRA_ROUTE_DURATION_SECONDS = 180;
export const MAX_ALTERNATIVE_EXTRA_ROUTE_DURATION_RATIO = 0.15;
export const MAX_TARGETED_MANEUVER_AVOIDANCES = 6;
export const TARGETED_MANEUVER_AVOIDANCE_FACTOR = 10;
const TARGETED_MANEUVER_MATCH_RADIUS_METERS = 35;
const TARGETED_MANEUVER_CONTEXT_METERS = 35;

export function decodeValhallaPolyline6(value: string): [number, number][] {
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

export function parseValhallaRouteLeg(value: unknown): AtlasRoutePathLeg {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("valhalla_route_invalid_leg");
  const leg = value as { shape?: unknown; summary?: { length?: unknown; time?: unknown }; maneuvers?: unknown };
  if (typeof leg.shape !== "string") throw new Error("valhalla_route_invalid_geometry");
  const coordinates = decodeValhallaPolyline6(leg.shape);
  const distanceKm = leg.summary?.length;
  const durationSeconds = leg.summary?.time;
  if (coordinates.length < 2 || coordinates.some(([longitude, latitude]) => !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    || typeof distanceKm !== "number" || !Number.isFinite(distanceKm) || distanceKm < 0
    || typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new Error("valhalla_route_invalid_leg");
  }
  const rawManeuvers = Array.isArray(leg.maneuvers) ? leg.maneuvers as RouteManeuver[] : [];
  const maneuvers = rawManeuvers.map((maneuver) => {
    const shapeIndex = typeof maneuver.begin_shape_index === "number" ? maneuver.begin_shape_index : -1;
    const location = shapeIndex >= 0 ? coordinates[shapeIndex] : undefined;
    return location ? { ...maneuver, longitude: location[0], latitude: location[1] } : maneuver;
  });
  return {
    coordinates,
    distanceMeters: Math.round(distanceKm * 1000),
    durationSeconds: Math.round(durationSeconds),
    uturnCount: countUTurns(maneuvers),
    maneuvers
  };
}

function pointDistanceMeters(a: [number, number], b: [number, number]) {
  const radians = Math.PI / 180;
  const latitude = ((a[1] + b[1]) / 2) * radians;
  return Math.hypot((a[0] - b[0]) * radians * Math.cos(latitude), (a[1] - b[1]) * radians) * 6_371_000;
}

function encodePolyline6(coordinates: [number, number][]) {
  let previousLatitude = 0;
  let previousLongitude = 0;
  let encoded = "";
  const encodeValue = (value: number) => {
    let remaining = value < 0 ? ~(value << 1) : value << 1;
    while (remaining >= 0x20) {
      encoded += String.fromCharCode((0x20 | (remaining & 0x1f)) + 63);
      remaining >>= 5;
    }
    encoded += String.fromCharCode(remaining + 63);
  };
  for (const [longitude, latitude] of coordinates) {
    const scaledLatitude = Math.round(latitude * 1e6);
    const scaledLongitude = Math.round(longitude * 1e6);
    encodeValue(scaledLatitude - previousLatitude);
    encodeValue(scaledLongitude - previousLongitude);
    previousLatitude = scaledLatitude;
    previousLongitude = scaledLongitude;
  }
  return encoded;
}

function maneuverContextShape(leg: AtlasRoutePathLeg, shapeIndex: number) {
  if (!Number.isInteger(shapeIndex) || shapeIndex < 0 || shapeIndex >= leg.coordinates.length) return null;
  let start = shapeIndex;
  let end = shapeIndex;
  let startDistance = 0;
  let endDistance = 0;
  while (start > 0 && startDistance < TARGETED_MANEUVER_CONTEXT_METERS) {
    startDistance += pointDistanceMeters(leg.coordinates[start]!, leg.coordinates[start - 1]!);
    start -= 1;
  }
  while (end < leg.coordinates.length - 1 && endDistance < TARGETED_MANEUVER_CONTEXT_METERS) {
    endDistance += pointDistanceMeters(leg.coordinates[end]!, leg.coordinates[end + 1]!);
    end += 1;
  }
  const shape = leg.coordinates.slice(start, end + 1);
  return shape.length >= 2 ? encodePolyline6(shape) : null;
}

/** Maps AI-flagged maneuver points back onto a Valhalla route edge corridor. */
export function buildManeuverLinearCostFactors(legs: AtlasRoutePathLeg[], targets: ManeuverAvoidanceTarget[]): ManeuverLinearCostFactor[] {
  if (!Array.isArray(legs) || !Array.isArray(targets) || targets.length === 0) return [];
  const factors: ManeuverLinearCostFactor[] = [];
  const seen = new Set<string>();
  for (const target of targets.slice(0, MAX_TARGETED_MANEUVER_AVOIDANCES)) {
    if (!Number.isInteger(target.routeLegIndex) || target.routeLegIndex < 0 || target.routeLegIndex >= legs.length
      || !Number.isFinite(target.latitude) || target.latitude < -90 || target.latitude > 90
      || !Number.isFinite(target.longitude) || target.longitude < -180 || target.longitude > 180) continue;
    const leg = legs[target.routeLegIndex]!;
    const targetPoint: [number, number] = [target.longitude, target.latitude];
    const nearest = leg.maneuvers
      .map((maneuver) => {
        const index = maneuver.begin_shape_index;
        const coordinate = typeof index === "number" ? leg.coordinates[index] : undefined;
        return coordinate ? { index: index as number, distance: pointDistanceMeters(targetPoint, coordinate) } : null;
      })
      .filter((candidate): candidate is { index: number; distance: number } => candidate !== null)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest || nearest.distance > TARGETED_MANEUVER_MATCH_RADIUS_METERS) continue;
    const shape = maneuverContextShape(leg, nearest.index);
    if (!shape || seen.has(`${target.routeLegIndex}:${shape}`)) continue;
    seen.add(`${target.routeLegIndex}:${shape}`);
    factors.push({ routeLegIndex: target.routeLegIndex, shape, factor: TARGETED_MANEUVER_AVOIDANCE_FACTOR });
  }
  return factors;
}

export function extractValhallaAlternateLegs(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("valhalla_alternates_invalid_response");
  const alternates = (value as Record<string, unknown>).alternates;
  if (alternates === undefined) return [];
  if (!Array.isArray(alternates)) throw new Error("valhalla_alternates_invalid_response");
  return alternates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const trip = (candidate as Record<string, unknown>).trip;
    if (!trip || typeof trip !== "object" || Array.isArray(trip)) return [];
    const tripRecord = trip as Record<string, unknown>;
    if (tripRecord.status !== 0 || !Array.isArray(tripRecord.legs) || tripRecord.legs.length !== 1) return [];
    const leg = tripRecord.legs[0];
    return leg && typeof leg === "object" && !Array.isArray(leg) ? [leg as Record<string, unknown>] : [];
  }).slice(0, MAX_ALTERNATES_PER_LEG);
}

/** Returns the highest priority leg indexes that currently contain real U-turn maneuvers. */
export function findUturnLegIndexes(legs: AtlasRoutePathLeg[], limit = MAX_ALTERNATIVE_LEGS): number[] {
  return legs
    .map((leg, index) => ({ index, uturnCount: leg.uturnCount, durationSeconds: leg.durationSeconds }))
    .filter(({ uturnCount }) => Number.isInteger(uturnCount) && uturnCount > 0)
    .sort((left, right) => right.uturnCount - left.uturnCount || right.durationSeconds - left.durationSeconds || left.index - right.index)
    .slice(0, Math.max(0, Math.min(MAX_ALTERNATIVE_LEGS, Math.floor(limit))))
    .map(({ index }) => index);
}

function durationAllowance(durationSeconds: number, ratio: number, cap: number) {
  return Math.min(cap, Math.max(0, durationSeconds * ratio));
}

function isValidLeg(leg: AtlasRoutePathLeg) {
  return Array.isArray(leg.coordinates) && leg.coordinates.length >= 2
    && leg.coordinates.every(([longitude, latitude]) => Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90)
    && Number.isFinite(leg.distanceMeters) && leg.distanceMeters >= 0
    && Number.isFinite(leg.durationSeconds) && leg.durationSeconds >= 0
    && Number.isInteger(leg.uturnCount) && leg.uturnCount >= 0;
}

function geometrySignature(leg: AtlasRoutePathLeg) {
  return leg.coordinates.map(([longitude, latitude]) => `${longitude.toFixed(5)},${latitude.toFixed(5)}`).join(";");
}

function eligibleLegAlternatives(base: AtlasRoutePathLeg, candidates: AtlasRoutePathLeg[]) {
  if (!isValidLeg(base) || base.uturnCount < 1) return [];
  const seen = new Set([geometrySignature(base)]);
  return candidates
    .filter(isValidLeg)
    .filter((candidate) => {
      const signature = geometrySignature(candidate);
      if (seen.has(signature)) return false;
      seen.add(signature);
      const addedDistanceMeters = candidate.distanceMeters - base.distanceMeters;
      const addedDurationSeconds = candidate.durationSeconds - base.durationSeconds;
      return candidate.uturnCount < base.uturnCount
        && addedDistanceMeters <= MAX_ALTERNATIVE_EXTRA_DISTANCE_METERS
        && addedDurationSeconds <= durationAllowance(base.durationSeconds, MAX_ALTERNATIVE_EXTRA_LEG_DURATION_RATIO, MAX_ALTERNATIVE_EXTRA_LEG_DURATION_SECONDS);
    })
    .slice(0, MAX_ALTERNATES_PER_LEG);
}

function routeTotals(legs: AtlasRoutePathLeg[]) {
  return legs.reduce((total, leg) => ({
    distanceMeters: total.distanceMeters + leg.distanceMeters,
    durationSeconds: total.durationSeconds + leg.durationSeconds,
    uturnCount: total.uturnCount + leg.uturnCount
  }), { distanceMeters: 0, durationSeconds: 0, uturnCount: 0 });
}

function isBetterPlan(candidate: ReturnType<typeof routeTotals>, current: ReturnType<typeof routeTotals>) {
  if (candidate.durationSeconds !== current.durationSeconds) return candidate.durationSeconds < current.durationSeconds;
  if (candidate.distanceMeters !== current.distanceMeters) return candidate.distanceMeters < current.distanceMeters;
  return candidate.uturnCount < current.uturnCount;
}

/** Selects a bounded set of per-leg Valhalla alternates and evaluates their recomposed full route. */
export function selectRoutePathAlternatives(
  baseLegs: AtlasRoutePathLeg[],
  alternativesByLeg: Map<number, AtlasRoutePathLeg[]>
): RouteAlternativeEvaluation | null {
  if (baseLegs.length === 0 || baseLegs.some((leg) => !isValidLeg(leg))) return null;
  const baseTotals = routeTotals(baseLegs);
  const eligibleIndexes = [...alternativesByLeg.keys()]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < baseLegs.length)
    .sort((a, b) => a - b)
    .slice(0, MAX_ALTERNATIVE_LEGS);
  const options = eligibleIndexes.map((index) => [
    baseLegs[index]!,
    ...eligibleLegAlternatives(baseLegs[index]!, alternativesByLeg.get(index) ?? [])
  ]);
  if (!options.some((legOptions) => legOptions.length > 1)) return null;

  const totalDurationAllowance = durationAllowance(baseTotals.durationSeconds, MAX_ALTERNATIVE_EXTRA_ROUTE_DURATION_RATIO, MAX_ALTERNATIVE_EXTRA_ROUTE_DURATION_SECONDS);
  let bestLegs: AtlasRoutePathLeg[] | null = null;
  let bestTotals = baseTotals;
  const selected = [...baseLegs];

  const evaluate = (optionIndex: number) => {
    if (optionIndex >= eligibleIndexes.length) {
      const totals = routeTotals(selected);
      // A mapped U-turn is legal unless there is evidence it requires reversing or is physically impossible.
      // Never trade away a faster full route merely to reduce the U-turn count.
      if (totals.uturnCount >= baseTotals.uturnCount || totals.durationSeconds > baseTotals.durationSeconds
        || totals.durationSeconds - baseTotals.durationSeconds > totalDurationAllowance) return;
      if (isBetterPlan(totals, bestTotals)) {
        bestLegs = [...selected];
        bestTotals = totals;
      }
      return;
    }
    const legIndex = eligibleIndexes[optionIndex]!;
    for (const option of options[optionIndex]!) {
      selected[legIndex] = option;
      evaluate(optionIndex + 1);
    }
    selected[legIndex] = baseLegs[legIndex]!;
  };

  evaluate(0);
  if (!bestLegs) return null;
  const chosenLegs = bestLegs as AtlasRoutePathLeg[];
  return {
    legs: chosenLegs,
    uturnsBefore: baseTotals.uturnCount,
    uturnsAfter: bestTotals.uturnCount,
    addedDistanceMeters: bestTotals.distanceMeters - baseTotals.distanceMeters,
    addedDurationSeconds: Math.round(bestTotals.durationSeconds - baseTotals.durationSeconds),
    changedLegCount: chosenLegs.reduce((count, leg, index) => count + (leg === baseLegs[index] ? 0 : 1), 0)
  };
}
