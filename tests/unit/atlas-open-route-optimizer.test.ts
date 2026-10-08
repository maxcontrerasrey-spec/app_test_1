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

  it("considers every address as a possible first stop in a large list", () => {
    const size = 40;
    const matrix = Array.from({ length: size }, (_, from) =>
      Array.from({ length: size }, (_, to) => from === to ? 0 : 100)
    );
    const expectedOrder = [35, 36, 37, 38, 39, ...Array.from({ length: 35 }, (_, index) => index)];
    for (let index = 1; index < expectedOrder.length; index += 1) {
      matrix[expectedOrder[index - 1]!]![expectedOrder[index]!] = 1;
    }

    const result = optimizeOpenRoute(matrix);

    expect(result.order).toEqual(expectedOrder);
    expect(result.durationSeconds).toBe(size - 1);
  });
});
