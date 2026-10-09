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


export const MAX_ALTERNATIVE_LEGS = 4;
export const MAX_ALTERNATES_PER_LEG = 2;
export const MAX_ALTERNATIVE_CONCURRENCY = 2;
export const ALTERNATIVE_REQUEST_TIMEOUT_MS = 7_000;
export const MAX_ALTERNATIVE_EXTRA_DISTANCE_METERS = 500;
export const MAX_ALTERNATIVE_EXTRA_LEG_DURATION_SECONDS = 120;
export const MAX_ALTERNATIVE_EXTRA_LEG_DURATION_RATIO = 0.25;
export const MAX_ALTERNATIVE_EXTRA_ROUTE_DURATION_SECONDS = 180;
export const MAX_ALTERNATIVE_EXTRA_ROUTE_DURATION_RATIO = 0.15;
export const MAX_OPERATIONALLY_VIABLE_ROUTE_SECONDS = 50 * 60;

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
      const withinDetourAllowance = totals.durationSeconds <= baseTotals.durationSeconds + totalDurationAllowance;
      const operationallyViable = totals.durationSeconds < MAX_OPERATIONALLY_VIABLE_ROUTE_SECONDS;
      if (totals.uturnCount >= baseTotals.uturnCount || !withinDetourAllowance
        || (totals.durationSeconds > baseTotals.durationSeconds && !operationallyViable)) return;
      const boundedViableDetour = totals.durationSeconds > baseTotals.durationSeconds && operationallyViable;
      if (isBetterPlan(totals, bestTotals) || (boundedViableDetour && bestTotals === baseTotals)) {
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
