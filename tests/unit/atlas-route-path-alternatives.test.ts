import { describe, expect, it } from "vitest";
import {
  findUturnLegIndexes,
  decodeValhallaPolyline6,
  MAX_ALTERNATIVE_EXTRA_DISTANCE_METERS,
  extractValhallaAlternateLegs,
  parseValhallaRouteLeg,
  selectRoutePathAlternatives,
  type AtlasRoutePathLeg
} from "../../supabase/functions/atlas-tomtom-planning/routePathAlternatives";

function leg(distanceMeters: number, durationSeconds: number, uturnCount: number, offset: number): AtlasRoutePathLeg {
  return {
    coordinates: [[-68.93 + offset, -22.45], [-68.929 + offset, -22.451]],
    distanceMeters,
    durationSeconds,
    uturnCount,
    maneuvers: uturnCount ? [{ type: 12 }] : [{ type: 7 }]
  };
}

describe("Atlas Valhalla route path alternatives", () => {
  it("decodes and validates the exact single-leg geometry and maneuver payload", () => {
    const routeLeg = parseValhallaRouteLeg({
      shape: "????",
      summary: { length: 0.25, time: 43.6 },
      maneuvers: [{ type: 12, begin_shape_index: 0 }]
    });

    expect(routeLeg.coordinates).toEqual([[0, 0], [0, 0]]);
    expect(routeLeg.distanceMeters).toBe(250);
    expect(routeLeg.durationSeconds).toBe(44);
    expect(routeLeg.uturnCount).toBe(1);
    expect(routeLeg.maneuvers[0]).toMatchObject({ type: 12, longitude: 0, latitude: 0 });
    expect(() => parseValhallaRouteLeg({ shape: "?", summary: { length: 1, time: 1 } })).toThrow("valhalla_route_invalid_geometry");
  });

  it("parses only successful single-leg alternatives from Valhalla's response contract", () => {
    const expectedLeg = { shape: "encoded", summary: { length: 1, time: 60 }, maneuvers: [{ type: 12 }] };

    expect(extractValhallaAlternateLegs({
      trip: { status: 0, legs: [{ shape: "base" }] },
      alternates: [
        { trip: { status: 0, legs: [expectedLeg] } },
        { trip: { status: 1, legs: [expectedLeg] } },
        { trip: { status: 0, legs: [expectedLeg, expectedLeg] } },
        null
      ]
    })).toEqual([expectedLeg]);
    expect(extractValhallaAlternateLegs({ trip: { status: 0 }, alternates: [] })).toEqual([]);
    expect(() => extractValhallaAlternateLegs({ alternates: "invalid" })).toThrow("valhalla_alternates_invalid_response");
  });

  it("accepts a faster alternate that removes a U-turn and recomposes all route legs", () => {
    const base = [leg(500, 100, 1, 0), leg(800, 120, 0, 1)];
    const alternate = leg(740, 99, 0, 2);

    const result = selectRoutePathAlternatives(base, new Map([[0, [alternate]]]))!;

    expect(result.legs).toEqual([alternate, base[1]]);
    expect(result.uturnsBefore).toBe(1);
    expect(result.uturnsAfter).toBe(0);
    expect(result.addedDistanceMeters).toBe(240);
    expect(result.addedDurationSeconds).toBe(-1);
    expect(result.changedLegCount).toBe(1);
  });

  it("keeps the baseline when an alternate exceeds the 1–2 block distance proxy", () => {
    const base = [leg(500, 100, 1, 0)];
    const tooFar = leg(500 + MAX_ALTERNATIVE_EXTRA_DISTANCE_METERS + 1, 100, 0, 1);

    expect(selectRoutePathAlternatives(base, new Map([[0, [tooFar]]]))).toBeNull();
  });

  it("keeps the baseline when avoiding the U-turn would exceed the duration allowance", () => {
    const base = [leg(500, 100, 1, 0)];
    const tooSlow = leg(600, 126, 0, 1);

    expect(selectRoutePathAlternatives(base, new Map([[0, [tooSlow]]]))).toBeNull();
  });

  it("allows a bounded slower alternative below the 50-minute operational threshold", () => {
    const base = [leg(500, 100, 1, 0)];
    const slowerWithoutUturn = leg(600, 101, 0, 1);

    expect(selectRoutePathAlternatives(base, new Map([[0, [slowerWithoutUturn]]]))).toMatchObject({
      uturnsBefore: 1,
      uturnsAfter: 0,
      addedDurationSeconds: 1
    });
  });

  it("does not apply a slower local alternative at or above 50 minutes total", () => {
    const base = [leg(500, 2_995, 1, 0)];
    const slowerWithoutUturn = leg(600, 3_000, 0, 1);

    expect(selectRoutePathAlternatives(base, new Map([[0, [slowerWithoutUturn]]]))).toBeNull();
  });

  it("does not prohibit a U-turn when no better valid alternative exists", () => {
    const base = [leg(500, 100, 1, 0)];
    const sameUturnCount = leg(550, 105, 1, 1);
    const stillHasUturn = leg(560, 105, 2, 2);

    expect(selectRoutePathAlternatives(base, new Map([[0, [sameUturnCount, stillHasUturn]]]))).toBeNull();
  });

  it("limits cumulative detour so it chooses a subset of individually valid legs", () => {
    const base = [leg(500, 60, 1, 0), leg(500, 60, 1, 1)];
    const firstAlternate = leg(600, 55, 0, 2);
    const secondAlternate = leg(600, 75, 0, 3);

    const result = selectRoutePathAlternatives(base, new Map([[0, [firstAlternate]], [1, [secondAlternate]]]))!;

    expect(result.uturnsAfter).toBe(1);
    expect(result.changedLegCount).toBe(1);
    expect(result.addedDurationSeconds).toBe(-5);
  });

  it("chooses an allowed viable detour over an excessive detour", () => {
    const base = [leg(500, 200, 1, 0)];
    const slower = leg(700, 240, 0, 1);
    const faster = leg(650, 205, 0, 2);

    expect(selectRoutePathAlternatives(base, new Map([[0, [slower, faster]]]))).toMatchObject({
      legs: [faster],
      addedDurationSeconds: 5
    });
  });

  it("prefers a shorter equal-time path that keeps a legal mapped U-turn", () => {
    const base = [leg(500, 200, 1, 0)];
    const longerWithoutUturn = leg(700, 200, 0, 1);

    expect(selectRoutePathAlternatives(base, new Map([[0, [longerWithoutUturn]]]))).toBeNull();
  });

  it("only searches up to four legs with actual U-turn evidence", () => {
    const base = [leg(100, 10, 1, 0), leg(100, 10, 0, 1), leg(100, 10, 2, 2), leg(100, 10, 1, 3), leg(100, 10, 1, 4), leg(100, 10, 1, 5)];

    expect(findUturnLegIndexes(base)).toEqual([2, 0, 3, 4]);
    expect(findUturnLegIndexes(base, 2)).toEqual([2, 0]);
  });

});
