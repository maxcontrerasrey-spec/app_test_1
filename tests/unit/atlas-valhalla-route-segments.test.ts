import { describe, expect, it } from "vitest";
import { buildRouteSegments } from "../../supabase/functions/atlas-tomtom-planning/routeSegments";

describe("Atlas Valhalla route request segments", () => {
  it("splits twelve locations into provider-sized overlapping segments", () => {
    const segments = buildRouteSegments(12);
    expect(segments).toEqual([{ start: 0, end: 10 }, { start: 9, end: 12 }]);
    expect(segments.every(({ start, end }) => end - start <= 10)).toBe(true);
    expect(segments[0]!.end - 1).toBe(segments[1]!.start);
  });

  it("covers every route leg exactly once for the maximum supported route", () => {
    const size = 151;
    const segments = buildRouteSegments(size);
    const legs = segments.flatMap(({ start, end }) => Array.from({ length: end - start - 1 }, (_, index) => start + index));
    expect(segments.every(({ start, end }) => end - start <= 10)).toBe(true);
    expect(legs).toEqual(Array.from({ length: size - 1 }, (_, index) => index));
  });

  it("rejects a segment configuration that cannot advance", () => {
    expect(() => buildRouteSegments(12, 1)).toThrow("invalid_route_dimensions");
  });
});
