import { describe, expect, it } from "vitest";
import { optimizeOpenRoute } from "../../supabase/functions/atlas-tomtom-planning/openRouteOptimizer";

describe("Atlas open route optimizer fixed destination", () => {
  const durations = [
    [0, 10, 8, 1],
    [10, 0, 1, 9],
    [8, 1, 0, 1],
    [1, 9, 1, 0]
  ];

  it("keeps the chosen destination last while optimizing all other points", () => {
    const result = optimizeOpenRoute(durations, undefined, 2);

    expect(result.order).toHaveLength(durations.length);
    expect(new Set(result.order)).toEqual(new Set([0, 1, 2, 3]));
    expect(result.order.at(-1)).toBe(2);
    expect(result.order[0]).not.toBe(2);
    expect(result.durationSeconds).toBeLessThanOrEqual(20);
  });

  it("rejects the first point as a fixed destination", () => {
    expect(() => optimizeOpenRoute(durations, undefined, 0)).toThrow("El destino fijado debe ser una parada distinta del primer punto.");
  });
});
