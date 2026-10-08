import type { AtlasStopAccessAdjustment } from "../services/atlasOperationsApi";

type RouteStop = { lat: number; lng: number };

/** Applies only server-returned coordinate shifts while retaining every original stop field. */
export function applyRouteAccessAdjustments<T extends RouteStop>(
  stops: T[],
  order: number[],
  adjustments: AtlasStopAccessAdjustment[] = []
): Array<T & { accessAdjustment?: { original: { lat: number; lng: number }; displacementMeters: number } }> {
  const adjustmentsByIndex = new Map(adjustments.map((adjustment) => [adjustment.stopIndex, adjustment]));
  return order.flatMap((index) => {
    const stop = stops[index];
    if (!stop) return [];
    const adjustment = adjustmentsByIndex.get(index);
    return adjustment ? [{
      ...stop,
      lat: adjustment.adjusted.lat,
      lng: adjustment.adjusted.lng,
      accessAdjustment: { original: adjustment.original, displacementMeters: adjustment.displacementMeters }
    }] : [stop];
  });
}
