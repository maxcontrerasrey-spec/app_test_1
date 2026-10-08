export type RouteManeuver = {
  type?: number;
  instruction?: string;
  begin_shape_index?: number;
  bearing_before?: number;
  bearing_after?: number;
  street_names?: string[];
  latitude?: number;
  longitude?: number;
};
export type RouteShapePoint = [number, number];

/** Keep stop arrival/departure guidance while forbidding U-turns at intermediate stops. */
export function routeLocationType(index: number, size: number): "break" | "break_through" {
  return index === 0 || index === size - 1 ? "break" : "break_through";
}

/** Valhalla maneuver codes 12 and 13 are U-turns. */
export function hasUTurn(maneuvers: RouteManeuver[]): boolean {
  return maneuvers.some((maneuver) => maneuver.type === 12 || maneuver.type === 13);
}

function bearing(from: RouteShapePoint, to: RouteShapePoint): number {
  const toRadians = Math.PI / 180;
  const lat1 = from[1] * toRadians;
  const lat2 = to[1] * toRadians;
  const deltaLongitude = (to[0] - from[0]) * toRadians;
  const y = Math.sin(deltaLongitude) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLongitude);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function distanceMeters(a: RouteShapePoint, b: RouteShapePoint): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (b[1] - a[1]) * radians;
  const longitudeDelta = (b[0] - a[0]) * radians;
  const latitudeMean = (a[1] + b[1]) * radians / 2;
  return Math.hypot(latitudeDelta, longitudeDelta * Math.cos(latitudeMean)) * 6_371_000;
}

/** Catch a 180-degree reversal introduced where a long route is split for Valhalla. */
export function hasUTurnAtSegmentJoin(previous: RouteShapePoint[], next: RouteShapePoint[], thresholdDegrees = 155): boolean {
  if (previous.length < 2 || next.length < 2) return false;
  const previousEnd = previous.at(-1)!;
  const nextStart = next[0]!;
  if (distanceMeters(previousEnd, nextStart) > 40) return false;

  const incoming = bearing(previous.at(-2)!, previousEnd);
  const outgoing = bearing(nextStart, next[1]!);
  const difference = Math.abs(incoming - outgoing);
  return Math.min(difference, 360 - difference) >= thresholdDegrees;
}
