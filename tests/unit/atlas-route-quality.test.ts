import { describe, expect, it } from "vitest";
import { hasUTurn, hasUTurnAtSegmentJoin, routeLocationType } from "../../supabase/functions/atlas-tomtom-planning/routeQuality";

describe("Atlas route feasibility guards", () => {
  it("forbids U-turn-capable breaks at intermediate stops", () => {
    expect([0, 1, 2, 3].map((index) => routeLocationType(index, 4))).toEqual(["break", "break_through", "break_through", "break"]);
  });

  it("recognizes Valhalla's left and right U-turn maneuvers", () => {
    expect(hasUTurn([{ type: 7 }, { type: 12 }])).toBe(true);
    expect(hasUTurn([{ type: 13 }])).toBe(true);
    expect(hasUTurn([{ type: 7 }, { type: 8 }])).toBe(false);
  });

  it("rejects a near-180 degree reversal at a split-route join", () => {
    const previous = [[-68.931, -22.454], [-68.930, -22.454]] as [number, number][];
    const reverse = [[-68.930, -22.454], [-68.931, -22.454]] as [number, number][];
    const continueForward = [[-68.930, -22.454], [-68.929, -22.454]] as [number, number][];
    expect(hasUTurnAtSegmentJoin(previous, reverse)).toBe(true);
    expect(hasUTurnAtSegmentJoin(previous, continueForward)).toBe(false);
  });
});
