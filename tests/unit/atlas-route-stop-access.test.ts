import { describe, expect, it } from "vitest";
import {
  collectStopAccessAdjustments,
  distanceBetweenPointsMeters,
  findStopsNearUTurns,
  isStopAccessRouteImproved,
  MAX_STOP_ACCESS_RADIUS_METERS
} from "../../supabase/functions/atlas-tomtom-planning/routeStopAccess";
import { applyRouteAccessAdjustments } from "../../src/modules/operaciones/lib/applyRouteAccessAdjustments";

describe("Atlas nearby stop access", () => {
  it("only selects stops next to U-turn maneuvers and caps the search", () => {
    const stops = Array.from({ length: 6 }, (_, index) => ({ lat: -22.45, lng: -68.93 + index * 0.001 }));
    const maneuvers = stops.slice(0, 5).map((stop) => ({ type: 12, latitude: stop.lat, longitude: stop.lng }));
    expect(findStopsNearUTurns(stops, maneuvers)).toHaveLength(4);
    expect(findStopsNearUTurns(stops, [{ type: 1, latitude: stops[5]!.lat, longitude: stops[5]!.lng }])).toEqual([]);
  });

  it("keeps candidate access changes in the 20 meter limit and ignores negligible snaps", () => {
    const origin = { lat: -22.45, lng: -68.93 };
    const atTenMeters = { lat: origin.lat, lng: origin.lng + 0.0001 };
    const beyondLimit = { lat: origin.lat, lng: origin.lng + 0.0003 };
    expect(distanceBetweenPointsMeters(origin, atTenMeters)).toBeGreaterThan(3);
    expect(distanceBetweenPointsMeters(origin, atTenMeters)).toBeLessThanOrEqual(MAX_STOP_ACCESS_RADIUS_METERS);
    expect(collectStopAccessAdjustments([origin, origin, origin], [origin, atTenMeters, beyondLimit], [0, 1, 2])).toMatchObject([
      { stopIndex: 1, original: origin, adjusted: atTenMeters }
    ]);
  });

  it("requires an objective route improvement", () => {
    expect(isStopAccessRouteImproved({ durationSeconds: 600, uturnCount: 2 }, { durationSeconds: 620, uturnCount: 1 })).toBe(true);
    expect(isStopAccessRouteImproved({ durationSeconds: 600, uturnCount: 2 }, { durationSeconds: 631, uturnCount: 1 })).toBe(false);
    expect(isStopAccessRouteImproved({ durationSeconds: 600, uturnCount: 1 }, { durationSeconds: 595, uturnCount: 1 })).toBe(false);
    expect(isStopAccessRouteImproved({ durationSeconds: 600, uturnCount: 1 }, { durationSeconds: 590, uturnCount: 1 })).toBe(true);
  });

  it("keeps stop identity, label, and a pinned destination while applying its adjusted access point", () => {
    const stops = [
      { id: "first", label: "Origen", lat: -22.45, lng: -68.93 },
      { id: "last", label: "Destino", lat: -22.46, lng: -68.94, fixedDestination: true }
    ];
    const result = applyRouteAccessAdjustments(stops, [0, 1], [{
      stopIndex: 1, original: { lat: -22.46, lng: -68.94 },
      adjusted: { lat: -22.4601, lng: -68.94 }, displacementMeters: 11
    }]);
    expect(result.map(({ id, label }) => ({ id, label }))).toEqual([{ id: "first", label: "Origen" }, { id: "last", label: "Destino" }]);
    expect(result[1]).toMatchObject({ fixedDestination: true, lat: -22.4601, lng: -68.94, accessAdjustment: { original: { lat: -22.46, lng: -68.94 }, displacementMeters: 11 } });
  });
});
