import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isRouteAuditOperationallyComplete, routeAuditSuggestsAlternative } from "../../src/modules/operaciones/components/AtlasRouteAuditPanel";
import { applyRouteAccessAdjustments } from "../../src/modules/operaciones/lib/applyRouteAccessAdjustments";
import { searchAuditedRoute } from "../../src/modules/operaciones/lib/auditedRouteSearch";
import { orderRouteStopsByIndex } from "../../supabase/functions/atlas-tomtom-planning/orderedRouteStops";
import { verifyPedestrianStopAccess } from "../../supabase/functions/atlas-tomtom-planning/pedestrianStopAccess";
import { isStopAccessRouteImproved } from "../../supabase/functions/atlas-tomtom-planning/routeStopAccess";
import type { AtlasRouteAuditResponse } from "../../src/modules/operaciones/services/atlasOperationsApi";

type Fixture = {
  fixtureId: string;
  status: string;
  stops: Array<{ id: string; label: string; lat: number; lng: number }>;
  optimizedOrder: number[];
  accessAdjustment: {
    stopIndex: number;
    adjusted: { lat: number; lng: number };
    pedestrianAccessMeters: number;
    maximumPedestrianAccessMeters: number;
    baseRoute: { durationSeconds: number; uturnCount: number };
    adjustedRoute: { durationSeconds: number; uturnCount: number };
  };
  auditedCandidates: Array<{
    id: string;
    order: number[];
    durationSeconds: number;
    decision: "APPROVE" | "REJECT";
    requiresReplan: boolean;
    requiresHumanReview: boolean;
    recommendedAction: "NONE" | "REQUEST_ALTERNATIVE";
  }>;
};

async function loadFixture() {
  return JSON.parse(await readFile(new URL("../fixtures/atlas-under-50-cross-street-ai-workflow.json", import.meta.url), "utf8")) as Fixture;
}

function persistedAudit(candidate: Fixture["auditedCandidates"][number], index: number): AtlasRouteAuditResponse {
  return {
    decision: candidate.decision,
    riskScore: candidate.decision === "REJECT" ? 80 : 10,
    summary: `Evaluación guardada ${candidate.id}`,
    analyzedManeuvers: candidate.recommendedAction === "NONE" ? [] : [{
      maneuverId: "m-001", decision: "REJECT", riskScore: 80, reasons: ["Alternativa recomendada"], evidence: ["Valhalla"], recommendedAction: candidate.recommendedAction
    }],
    requiresReplan: candidate.requiresReplan,
    requiresHumanReview: candidate.requiresHumanReview,
    routeDurationSeconds: candidate.durationSeconds,
    runId: `run-${index + 1}`,
    mode: "SHADOW",
    provider: "openai",
    auditedManeuverCount: 1
  };
}

describe("Atlas route proposal to AI audit workflow", () => {
  it("keeps a short cross-street stop adjustment aligned through optimization and persisted AI alternatives", async () => {
    const fixture = await loadFixture();
    expect(fixture.status).toBe("synthetic_workflow_fixture_not_production_route_truth");

    const access = await verifyPedestrianStopAccess(
      [{ ...fixture.accessAdjustment, label: "cross-street stop" }],
      async () => fixture.accessAdjustment.pedestrianAccessMeters,
      async () => [],
      fixture.accessAdjustment.maximumPedestrianAccessMeters
    );
    expect(access).toHaveLength(1);
    expect(access![0]!.pedestrianAccessMeters).toBe(11);
    expect(isStopAccessRouteImproved(fixture.accessAdjustment.baseRoute, fixture.accessAdjustment.adjustedRoute)).toBe(true);

    const stopsByInputIndex = fixture.stops.map((stop) => ({ ...stop }));
    stopsByInputIndex[fixture.accessAdjustment.stopIndex] = {
      ...stopsByInputIndex[fixture.accessAdjustment.stopIndex]!,
      ...fixture.accessAdjustment.adjusted
    };
    const signedStopSequence = orderRouteStopsByIndex(stopsByInputIndex, fixture.optimizedOrder);
    const clientStopSequence = applyRouteAccessAdjustments(fixture.stops, fixture.optimizedOrder, [{
      ...fixture.accessAdjustment,
      original: { lat: fixture.stops[fixture.accessAdjustment.stopIndex]!.lat, lng: fixture.stops[fixture.accessAdjustment.stopIndex]!.lng },
      displacementMeters: 9
    }]);
    expect(signedStopSequence.map(({ id, lat, lng }) => ({ id, lat, lng }))).toEqual(
      clientStopSequence.map(({ id, lat, lng }) => ({ id, lat, lng }))
    );
    expect(signedStopSequence.map(({ id }) => id)).toEqual(["B", "A", "D"]);
    expect(signedStopSequence[0]!.lat).toBe(fixture.accessAdjustment.adjusted.lat);

    const candidates = fixture.auditedCandidates.map((candidate) => ({
      id: candidate.id,
      order: candidate.order,
      durationSeconds: candidate.durationSeconds,
      stops: orderRouteStopsByIndex(stopsByInputIndex, candidate.order)
    }));
    const auditRuns: string[] = [];
    const search = await searchAuditedRoute({ value: candidates[0]!, order: candidates[0]!.order }, {
      audit: async (candidate) => {
        const fixtureAudit = fixture.auditedCandidates.find(({ id }) => id === candidate.id)!;
        const audit = persistedAudit(fixtureAudit, auditRuns.length);
        if (audit.runId) auditRuns.push(audit.runId);
        expect(isRouteAuditOperationallyComplete("ready", audit)).toBe(true);
        return audit;
      },
      shouldExploreAlternative: routeAuditSuggestsAlternative,
      selectViableFallback: (evaluated) => evaluated
        .filter(({ audit }) => audit.routeDurationSeconds !== null && audit.routeDurationSeconds < 3_000)
        .sort((left, right) => left.audit.routeDurationSeconds! - right.audit.routeDurationSeconds!)[0] ?? null,
      hasPersistedEvaluation: (audit) => Boolean(audit.runId && audit.provider === "openai" && audit.mode === "SHADOW" && audit.decision !== "ERROR" && (audit.auditedManeuverCount ?? 0) > 0),
      findAlternative: async (excluded) => {
        const next = candidates.find((candidate) => !excluded.some((order) => order.join(",") === candidate.order.join(",")));
        return next ? { value: next, order: next.order } : null;
      }
    });

    expect(search.status).toBe("accepted");
    expect(search.candidate.id).toBe("alternative-2");
    expect(search.candidate.durationSeconds).toBe(2_550);
    expect(search.audit?.runId).toBe("run-3");
    expect(search.auditAttempts).toBe(3);
    expect(search.alternativeAttempts).toBe(2);
    expect(auditRuns).toEqual(["run-1", "run-2", "run-3"]);
  });

  it.each([2_999, 3_000, 3_001])("applies the strict 50-minute rule to the exact audited route (%i seconds)", async (durationSeconds) => {
    const fixture = await loadFixture();
    const route = persistedAudit({ ...fixture.auditedCandidates[0]!, durationSeconds }, 0);
    expect(isRouteAuditOperationallyComplete("ready", route)).toBe(durationSeconds < 3_000);
  });

  it("blocks the proposal when its OpenAI run is not persisted", async () => {
    const fixture = await loadFixture();
    const audit = { ...persistedAudit(fixture.auditedCandidates[0]!, 0), runId: null };
    expect(isRouteAuditOperationallyComplete("ready", audit)).toBe(false);
  });
});
