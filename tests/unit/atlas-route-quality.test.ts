import { describe, expect, it } from "vitest";
import { countUTurns, hasUTurn, routeLocationType } from "../../supabase/functions/atlas-tomtom-planning/routeQuality";

describe("Atlas route maneuver handling", () => {
  it("allows Valhalla to choose a U-turn at any stop when the road graph supports it", () => {
    expect([0, 1, 2, 3].map((index) => routeLocationType(index, 4))).toEqual(["break", "break", "break", "break"]);
  });

  it("classifies and counts U-turn maneuvers without treating them as a route failure", () => {
    expect(hasUTurn([{ type: 7 }, { type: 12 }])).toBe(true);
    expect(hasUTurn([{ type: 13 }])).toBe(true);
    expect(hasUTurn([{ type: 7 }, { type: 8 }])).toBe(false);
    expect(countUTurns([{ type: 12 }, { type: 13 }, { type: 8 }])).toBe(2);
    expect(countUTurns([{ type: 7 }, { type: 8 }])).toBe(0);
  });
});
