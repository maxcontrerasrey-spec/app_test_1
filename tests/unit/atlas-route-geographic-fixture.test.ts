import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { optimizeOpenRoute } from "../../supabase/functions/atlas-tomtom-planning/openRouteOptimizer";
import { buildRouteOrderAlternatives, selectFastestRoutedOrder } from "../../supabase/functions/atlas-tomtom-planning/routeOrderAlternatives";

type ObservedRoute = { order: number[]; durationSeconds: number; distanceMeters: number; uturnCount: number };
type ProfileObservation = {
  dimensions: { length: number; width: number; height: number; weight: number };
  matrixDurations: number[][];
  optimizedOrder: number[];
  matrixInputSeconds: number;
  matrixOptimizedSeconds: number;
  inputRoute: ObservedRoute;
  optimizedRoute: ObservedRoute;
};
type GeographicFixture = {
  fixtureId: string;
  status: string;
  stops: Array<{ label: string; lat: number; lng: number }>;
  profiles: Record<"Bus" | "Taxibus" | "Minibus", ProfileObservation>;
  exhaustiveBusOrderSearch: {
    evaluated: number;
    successful: number;
    failed: number;
    best: ObservedRoute;
    results: ObservedRoute[];
  };
};

async function loadFixture(): Promise<GeographicFixture> {
  const content = await readFile(new URL("../fixtures/atlas-route-calama-four-stop-valhalla.json", import.meta.url), "utf8");
  return JSON.parse(content) as GeographicFixture;
}

describe("Atlas Valhalla geographic fixture", () => {
  it("reorders the reference stops and matches the fastest complete route among all bus permutations", async () => {
    const fixture = await loadFixture();
    const bus = fixture.profiles.Bus;
    const optimized = optimizeOpenRoute(bus.matrixDurations);
    const fastestObserved = [...fixture.exhaustiveBusOrderSearch.results]
      .sort((left, right) => left.durationSeconds - right.durationSeconds
        || left.distanceMeters - right.distanceMeters
        || left.order.join(",").localeCompare(right.order.join(",")))[0];

    expect(fixture.fixtureId).toBe("calama-center-four-stop-valhalla-2026-10-09");
    expect(fixture.status).toBe("exploratory_geographic_fixture_not_production_address_truth");
    expect(fixture.exhaustiveBusOrderSearch).toMatchObject({ evaluated: 24, successful: 24, failed: 0 });
    expect(new Set(fixture.exhaustiveBusOrderSearch.results.map(({ order }) => order.join(","))).size).toBe(24);
    expect(optimized.order).toEqual(bus.optimizedOrder);
    expect(optimized.order).toEqual(fastestObserved?.order);
    expect(fastestObserved).toEqual(fixture.exhaustiveBusOrderSearch.best);
    expect(bus.optimizedRoute.durationSeconds).toBeLessThan(bus.inputRoute.durationSeconds);
    expect(bus.optimizedRoute.distanceMeters).toBeLessThan(bus.inputRoute.distanceMeters);
    expect(bus.optimizedRoute.uturnCount).toBe(0);
  });

  it("reproduces the selected and input order for each reference vehicle profile", async () => {
    const fixture = await loadFixture();
    for (const profile of Object.values(fixture.profiles)) {
      const optimized = optimizeOpenRoute(profile.matrixDurations);
      expect(optimized.order).toEqual(profile.optimizedOrder);
      expect(optimized.durationSeconds).toBe(profile.matrixOptimizedSeconds);
      expect(optimized.inputOrderDurationSeconds).toBe(profile.matrixInputSeconds);
      expect(profile.optimizedRoute.order).toEqual(optimized.order);
      expect(profile.optimizedRoute.durationSeconds).toBeLessThan(profile.inputRoute.durationSeconds);
    }
  });

  it("replays a screenshot-derived five-stop case through the bounded full-route selector", async () => {
    const content = await readFile(new URL("../fixtures/atlas-route-calama-screenshot-five-stops-valhalla.json", import.meta.url), "utf8");
    const fixture = JSON.parse(content) as {
      optimizer: { selectedOrder: number[]; matrixDurationSeconds: number; candidateBudget: number; candidateOrders: number[][] };
      matrix: number[][];
      observedCandidateRoutes: ObservedRoute[];
      selection: { selectedOrder: number[]; durationSeconds: number; distanceMeters: number; uturnCount: number; alternativesEvaluated: number; alternativesFailed: number; fastestObservedWithinBoundedSearch: boolean; under50Minutes: boolean };
    };
    const optimized = optimizeOpenRoute(fixture.matrix);
    const candidates = buildRouteOrderAlternatives(fixture.matrix, optimized.order, undefined, fixture.optimizer.candidateBudget);
    const observed = new Map(fixture.observedCandidateRoutes.map((route) => [route.order.join(","), route]));
    const selected = await selectFastestRoutedOrder(
      { order: optimized.order, matrixDurationSeconds: optimized.durationSeconds },
      observed.get(optimized.order.join(","))!,
      candidates,
      async (order) => observed.get(order.join(",")) ?? null
    );

    expect(optimized.order).toEqual(fixture.optimizer.selectedOrder);
    expect(candidates.map(({ order }) => order)).toEqual(fixture.optimizer.candidateOrders);
    expect(selected.order).toEqual(fixture.selection.selectedOrder);
    expect(selected.route.durationSeconds).toBe(fixture.selection.durationSeconds);
    expect(selected.route).toMatchObject({
      durationSeconds: fixture.selection.durationSeconds,
      distanceMeters: fixture.selection.distanceMeters,
      uturnCount: fixture.selection.uturnCount
    });
    expect(selected.alternativesEvaluated).toBe(fixture.selection.alternativesEvaluated);
    expect(selected.alternativesFailed).toBe(fixture.selection.alternativesFailed);
    expect(new Set(fixture.observedCandidateRoutes.map(({ order }) => order.join(","))).size).toBe(9);
    expect(fixture.observedCandidateRoutes.some((route) => route.uturnCount > 0)).toBe(true);
    expect(fixture.selection.durationSeconds).toBeLessThan(3_000);
  });
});
