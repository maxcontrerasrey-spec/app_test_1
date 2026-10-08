export type RouteStopPoint = { lat: number; lng: number };
export type RouteManeuverEvidence = { type?: number | string; latitude?: number | null; longitude?: number | null };
export type StopAccessAdjustment = {
  stopIndex: number;
  original: RouteStopPoint;
  adjusted: RouteStopPoint;
  displacementMeters: number;
  pedestrianAccessMeters?: number;
};

export const MAX_STOP_ACCESS_RADIUS_METERS = 20;
export const MAX_STOP_ACCESS_WALK_METERS = 30;
export const MIN_STOP_ACCESS_CHANGE_METERS = 3;
export const MAX_UTURN_STOP_CANDIDATES = 4;
export const MAX_ACCEPTABLE_DETOUR_FOR_UTURN_SECONDS = 0.05;
export const MIN_ROUTE_TIME_IMPROVEMENT_SECONDS = 10;

export function distanceBetweenPointsMeters(a: RouteStopPoint, b: RouteStopPoint): number {
  const radians = Math.PI / 180;
  const latitudeA = a.lat * radians;
  const latitudeB = b.lat * radians;
  const latitudeDelta = (b.lat - a.lat) * radians;
  const longitudeDelta = (b.lng - a.lng) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

const TURNING_MANEUVER_TYPES = new Set([9, 10, 11, 12, 13, 14, 15, 16]);

/** Check nearby stop access when Valhalla places a real turn close to the pickup/dropoff. */
export function findStopsNearTurningManeuvers(
  stops: RouteStopPoint[],
  maneuvers: RouteManeuverEvidence[],
  radiusMeters = 25,
  limit = MAX_UTURN_STOP_CANDIDATES
): number[] {
  const eligible = new Map<number, number>();
  for (const maneuver of maneuvers) {
    if (!(typeof maneuver.type === "number" ? TURNING_MANEUVER_TYPES.has(maneuver.type) : maneuver.type === "LEFT" || maneuver.type === "RIGHT" || maneuver.type === "UTURN") || !Number.isFinite(maneuver.latitude) || !Number.isFinite(maneuver.longitude)) continue;
    const location = { lat: maneuver.latitude!, lng: maneuver.longitude! };
    stops.forEach((stop, index) => {
      const distance = distanceBetweenPointsMeters(stop, location);
      if (distance <= radiusMeters && (!eligible.has(index) || distance < eligible.get(index)!)) eligible.set(index, distance);
    });
  }
  return [...eligible.entries()]
    .sort((left, right) => left[1] - right[1] || left[0] - right[0])
    .slice(0, Math.max(0, limit))
    .map(([index]) => index);
}

/** Extracts only meaningful snapped changes, bounded by the configured walk/transfer radius. */
export function collectStopAccessAdjustments(
  originalStops: RouteStopPoint[],
  snappedStops: RouteStopPoint[],
  eligibleStopIndexes: number[]
): StopAccessAdjustment[] {
  if (originalStops.length !== snappedStops.length) return [];
  return [...new Set(eligibleStopIndexes)].flatMap((stopIndex) => {
    const original = originalStops[stopIndex];
    const adjusted = snappedStops[stopIndex];
    if (!original || !adjusted) return [];
    const displacementMeters = distanceBetweenPointsMeters(original, adjusted);
    if (displacementMeters < MIN_STOP_ACCESS_CHANGE_METERS || displacementMeters > MAX_STOP_ACCESS_RADIUS_METERS) return [];
    return [{ stopIndex, original, adjusted, displacementMeters: Math.round(displacementMeters) }];
  });
}

/** A stop move counts only if it removes a turn without a material time penalty, or makes the whole route faster. */
export function isStopAccessRouteImproved(
  baseline: { durationSeconds: number; uturnCount: number; turnCount?: number },
  candidate: { durationSeconds: number; uturnCount: number; turnCount?: number }
): boolean {
  if (!Number.isFinite(baseline.durationSeconds) || !Number.isFinite(candidate.durationSeconds)) return false;
  if (candidate.uturnCount < baseline.uturnCount || (baseline.turnCount !== undefined && candidate.turnCount !== undefined && candidate.turnCount < baseline.turnCount)) {
    return candidate.durationSeconds <= baseline.durationSeconds * (1 + MAX_ACCEPTABLE_DETOUR_FOR_UTURN_SECONDS);
  }
  return candidate.uturnCount <= baseline.uturnCount
    && baseline.durationSeconds - candidate.durationSeconds >= MIN_ROUTE_TIME_IMPROVEMENT_SECONDS;
}
