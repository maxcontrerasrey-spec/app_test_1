import { describe, expect, it } from "vitest";
import { optimizeOpenRoute } from "../../supabase/functions/atlas-tomtom-planning/openRouteOptimizer";

describe("Atlas open route optimizer", () => {
  it("chooses the first and last points from a directed road-time matrix", () => {
    const result = optimizeOpenRoute([
      [0, 10, 1],
      [1, 0, 10],
      [10, 4, 0]
    ]);
    expect(result.order).toEqual([1, 0, 2]);
    expect(result.durationSeconds).toBe(2);
    expect(result.inputOrderDurationSeconds).toBe(20);
  });

  it("rejects a matrix that cannot connect every direction", () => {
    expect(() => optimizeOpenRoute([
      [0, Number.POSITIVE_INFINITY],
      [Number.POSITIVE_INFINITY, 0]
    ])).toThrow("Valhalla no encontró conexiones transitables");
  });

  it("rejects malformed point orders", () => {
    expect(() => optimizeOpenRoute([[0, 1], [1, 0]], [0, 0])).toThrow("El orden de entrada");
  });
});
