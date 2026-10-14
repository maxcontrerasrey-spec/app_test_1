import { describe, expect, it, vi } from "vitest";
import { selectFastestAdjustedStopRoute } from "../../supabase/functions/atlas-tomtom-planning/adjustedStopRouteSearch";

const matrix = Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) => row === column ? 0 : 10));

describe("selectFastestAdjustedStopRoute", () => {
  it("traces bounded adjusted orders and selects by complete route duration", async () => {
    const evaluate = vi.fn(async (order: number[]) => ({
      distanceMeters: 1_000,
      durationSeconds: order.join(",") === "0,2,1,3" ? 700 : order.join(",") === "0,1,2,3" ? 800 : 900
    }));

    const result = await selectFastestAdjustedStopRoute({
      matrix,
      matrixSeedOrder: [0, 1, 2, 3],
      baselineOrder: [1, 0, 2, 3],
      baselineRoute: { distanceMeters: 1_100, durationSeconds: 850 },
      fixedDestinationIndex: 3,
      candidateBudget: 3,
      evaluate
    });

    expect(result.order).toEqual([0, 2, 1, 3]);
    expect(result.route.durationSeconds).toBe(700);
    expect(result.alternativesEvaluated).toBe(3);
    expect(result.alternativeApplied).toBe(true);
    expect(evaluate).toHaveBeenCalledTimes(3);
    expect(evaluate.mock.calls.every(([order]) => order.at(-1) === 3)).toBe(true);
  });

  it("keeps the already-routed adjusted access order when every candidate fails", async () => {
    const baselineRoute = { distanceMeters: 1_100, durationSeconds: 850 };
    const evaluate = vi.fn(async () => null);

    const result = await selectFastestAdjustedStopRoute({
      matrix,
      matrixSeedOrder: [0, 1, 2, 3],
      baselineOrder: [1, 0, 2, 3],
      baselineRoute,
      fixedDestinationIndex: 3,
      candidateBudget: 2,
      evaluate
    });

    expect(result.order).toEqual([1, 0, 2, 3]);
    expect(result.route).toBe(baselineRoute);
    expect(result.alternativesFailed).toBe(2);
    expect(result.alternativeApplied).toBe(false);
  });

  it("rejects an invalid alternative budget", async () => {
    await expect(selectFastestAdjustedStopRoute({
      matrix,
      matrixSeedOrder: [0, 1, 2, 3],
      baselineOrder: [1, 0, 2, 3],
      baselineRoute: { distanceMeters: 1_100, durationSeconds: 850 },
      candidateBudget: 0,
      evaluate: async () => null
    })).rejects.toThrow("presupuesto de órdenes");
  });
});
