import { describe, expect, it } from "vitest";
import { buildRouteOrderAlternatives, routeOrderAlternativeBudget, selectFastestRoutedOrder } from "../../supabase/functions/atlas-tomtom-planning/routeOrderAlternatives";

describe("Atlas automatic route-feasibility alternatives", () => {
  it("generates distinct nearby orders ranked by directed road duration", () => {
    const durations = [
      [0, 2, 20, 25],
      [20, 0, 2, 20],
      [20, 20, 0, 2],
      [20, 20, 20, 0]
    ];
    const alternatives = buildRouteOrderAlternatives(durations, [0, 1, 2, 3], undefined, 4);

    expect(alternatives.length).toBe(4);
    expect(new Set(alternatives.map(({ order }) => order.join(","))).size).toBe(4);
    expect(alternatives.every(({ order }) => order.length === durations.length && new Set(order).size === durations.length)).toBe(true);
    expect(alternatives.map(({ matrixDurationSeconds }) => matrixDurationSeconds)).toEqual(
      [...alternatives.map(({ matrixDurationSeconds }) => matrixDurationSeconds)].sort((a, b) => a - b)
    );
  });

  it("never moves a destination fixed by the planner", () => {
    const durations = [
      [0, 5, 2, 10],
      [8, 0, 4, 3],
      [3, 5, 0, 1],
      [4, 4, 4, 0]
    ];
    const alternatives = buildRouteOrderAlternatives(durations, [0, 1, 2, 3], 3, 10);

    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.every(({ order }) => order.at(-1) === 3)).toBe(true);
    expect(alternatives.every(({ order }) => new Set(order).size === durations.length)).toBe(true);
  });

  it("keeps alternative tracing bounded but does not skip long lists", () => {
    expect([20, 21, 50, 51, 100, 101, 151].map(routeOrderAlternativeBudget)).toEqual([8, 6, 6, 4, 4, 2, 2]);
    expect(() => routeOrderAlternativeBudget(152)).toThrow("La cantidad de paradas no es válida.");
  });

  it("adds candidates around multiple local optima and includes the alternate seed itself", () => {
    const durations = [
      [0, 2, 20, 25],
      [20, 0, 2, 20],
      [20, 20, 0, 2],
      [20, 20, 20, 0]
    ];
    const primary = [0, 1, 2, 3];
    const secondary = [0, 2, 1, 3];
    const alternatives = buildRouteOrderAlternatives(durations, primary, undefined, 24, [secondary]);
    expect(alternatives.some(({ order }) => order.join(",") === secondary.join(","))).toBe(true);
    expect(alternatives.every(({ order }) => order.join(",") !== primary.join(","))).toBe(true);
  });

  it("never returns a route order the user already asked it to replace", () => {
    const alreadyRejected = [1, 0, 2, 3];
    const alternatives = buildRouteOrderAlternatives(
      Array.from({ length: 4 }, (_, from) => Array.from({ length: 4 }, (_, to) => from === to ? 0 : Math.abs(from - to) + 1)),
      [0, 1, 2, 3],
      3,
      24,
      [],
      [alreadyRejected]
    );
    expect(alternatives.every(({ order }) => order.join(",") !== alreadyRejected.join(","))).toBe(true);
  });

  it("returns no alternative when a two-point route has an immutable destination", () => {
    expect(buildRouteOrderAlternatives([[0, 1], [1, 0]], [0, 1], 1, 5)).toEqual([]);
  });

  it("chooses the fastest complete Valhalla route rather than trusting matrix ranking", async () => {
    const durations = [
      [0, 2, 3, 8],
      [3, 0, 2, 3],
      [2, 3, 0, 2],
      [3, 3, 3, 0]
    ];
    const seed = { order: [0, 1, 2, 3], matrixDurationSeconds: 6 };
    const candidates = buildRouteOrderAlternatives(durations, seed.order, 3, 2);
    const result = await selectFastestRoutedOrder(seed, { durationSeconds: 600, distanceMeters: 6000 }, candidates, async (order) => {
      if (order[1] === 2) return { durationSeconds: 700, distanceMeters: 7000 };
      return { durationSeconds: 500, distanceMeters: 5200 };
    });

    expect(result.alternativeApplied).toBe(true);
    expect(result.route.durationSeconds).toBe(500);
    expect(result.order.at(-1)).toBe(3);
    expect(new Set(result.order).size).toBe(4);
  });

  it("keeps the Valhalla seed when every alternative fails or is slower", async () => {
    const seed = { order: [0, 1, 2], matrixDurationSeconds: 5 };
    const candidates = buildRouteOrderAlternatives([[0, 2, 3], [3, 0, 2], [2, 3, 0]], seed.order, undefined, 2);
    const result = await selectFastestRoutedOrder(seed, { durationSeconds: 400, distanceMeters: 4000 }, candidates, async () => null);
    expect(result.alternativeApplied).toBe(false);
    expect(result.order).toEqual(seed.order);
  });

  it("checks the full bounded candidate set with concurrency and reports all failures", async () => {
    const seed = { order: [0, 1, 2, 3], matrixDurationSeconds: 20 };
    const candidates = buildRouteOrderAlternatives([
      [0, 1, 2, 3], [3, 0, 1, 2], [2, 3, 0, 1], [1, 2, 3, 0]
    ], seed.order, undefined, 6);
    let active = 0;
    let maxActive = 0;
    const result = await selectFastestRoutedOrder(seed, { durationSeconds: 900, distanceMeters: 9000 }, candidates, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      throw new Error("no transit route");
    }, 2);

    expect(maxActive).toBe(2);
    expect(result.alternativesEvaluated).toBe(candidates.length);
    expect(result.alternativesFailed).toBe(candidates.length);
    expect(result.alternativeApplied).toBe(false);
  });
});
