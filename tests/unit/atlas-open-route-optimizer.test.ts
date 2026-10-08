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

  it("matches an independent exhaustive oracle for a directed small-route matrix", () => {
    const size = 9;
    const matrix = Array.from({ length: size }, (_, from) =>
      Array.from({ length: size }, (_, to) => from === to ? 0 : ((from + 3) * (to + 7) * 17 % 43) + 1)
    );
    const costs: number[] = [];
    const visit = (order: number[], remaining: number[]) => {
      if (!remaining.length) {
        costs.push(order.slice(1).reduce((sum, point, index) => sum + matrix[order[index]!]![point]!, 0));
        return;
      }
      for (const point of remaining) visit([...order, point], remaining.filter((candidate) => candidate !== point));
    };
    visit([], Array.from({ length: size }, (_, index) => index));

    const result = optimizeOpenRoute(matrix);
    expect(result.durationSeconds).toBe(costs.reduce((minimum, cost) => Math.min(minimum, cost), Infinity));
    expect(result.searchMethod).toBe("EXACT_OPEN_PATH_UP_TO_12");
  });

  it("keeps a fixed destination last and matches exhaustive ordering of all other stops", () => {
    const size = 7;
    const fixedDestination = 5;
    const matrix = Array.from({ length: size }, (_, from) =>
      Array.from({ length: size }, (_, to) => from === to ? 0 : ((from + 2) * (to + 11) * 19 % 47) + 1)
    );
    const costs: number[] = [];
    const movable = Array.from({ length: size }, (_, index) => index).filter((index) => index !== fixedDestination);
    const visit = (order: number[], remaining: number[]) => {
      if (!remaining.length) {
        const fullOrder = [...order, fixedDestination];
        costs.push(fullOrder.slice(1).reduce((sum, point, index) => sum + matrix[fullOrder[index]!]![point]!, 0));
        return;
      }
      for (const point of remaining) visit([...order, point], remaining.filter((candidate) => candidate !== point));
    };
    visit([], movable);

    const result = optimizeOpenRoute(matrix, undefined, fixedDestination);
    expect(result.order.at(-1)).toBe(fixedDestination);
    expect(result.durationSeconds).toBe(Math.min(...costs));
  });

  it("finds the same optimum when input locations are permuted", () => {
    const matrix = [
      [0, 23, 6, 18, 11, 29],
      [16, 0, 24, 7, 20, 13],
      [8, 19, 0, 25, 5, 17],
      [21, 10, 15, 0, 26, 4],
      [14, 27, 9, 12, 0, 22],
      [28, 3, 18, 16, 7, 0]
    ];
    const permutation = [3, 0, 5, 2, 1, 4];
    const permutedMatrix = permutation.map((from) => permutation.map((to) => matrix[from]![to]!));
    const original = optimizeOpenRoute(matrix);
    const permuted = optimizeOpenRoute(permutedMatrix);
    const mappedBack = permuted.order.map((index) => permutation[index]!);
    const cost = (order: number[]) => order.slice(1).reduce((sum, point, index) => sum + matrix[order[index]!]![point]!, 0);

    expect(cost(mappedBack)).toBe(original.durationSeconds);
  });
});
