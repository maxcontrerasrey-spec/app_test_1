export type RouteSegment = { start: number; end: number };

/** Split route requests into provider-sized chunks while sharing boundary stops. */
export function buildRouteSegments(size: number, maxLocations = 10): RouteSegment[] {
  if (!Number.isInteger(size) || size < 2 || !Number.isInteger(maxLocations) || maxLocations < 2) {
    throw new Error("invalid_route_dimensions");
  }
  const segments: RouteSegment[] = [];
  for (let start = 0; start < size - 1; start += maxLocations - 1) {
    segments.push({ start, end: Math.min(start + maxLocations, size) });
  }
  return segments;
}
