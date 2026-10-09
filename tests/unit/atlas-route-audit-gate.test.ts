import { describe, expect, it } from "vitest";
import { isRouteAuditEvaluationComplete, isRouteAuditOperationallyComplete, routeAuditRequiresReplan } from "../../src/modules/operaciones/components/AtlasRouteAuditPanel";
import type { AtlasRouteAuditResponse } from "../../src/modules/operaciones/services/atlasOperationsApi";

const successfulAudit: AtlasRouteAuditResponse = {
  decision: "WARNING", riskScore: 25, summary: "Revisión operacional recomendada", analyzedManeuvers: [],
  requiresReplan: false, requiresHumanReview: true, routeDurationSeconds: 1_000, runId: "run-1", mode: "SHADOW", provider: "openai", auditedManeuverCount: 2
};

describe("Atlas mandatory route audit gate", () => {
  it("treats every under-50-minute route as operationally viable without extra feedback", () => {
    expect(isRouteAuditEvaluationComplete("ready", successfulAudit)).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", successfulAudit)).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", successfulAudit, false)).toBe(true);
  });

  it("allows an audited proposal without extra feedback when human review is not requested", () => {
    expect(isRouteAuditOperationallyComplete("ready", { ...successfulAudit, requiresHumanReview: false })).toBe(true);
  });

  it("keeps insufficient-evidence findings visible without blocking an under-50-minute route", () => {
    const contradictory = { ...successfulAudit, requiresHumanReview: false, decision: "INSUFFICIENT_EVIDENCE" as const };
    expect(isRouteAuditEvaluationComplete("ready", contradictory)).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", contradictory)).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", contradictory, false)).toBe(true);
  });

  it("keeps AI maneuver findings advisory below 50 minutes and blocking at or above it", () => {
    const insufficient = { ...successfulAudit, requiresHumanReview: false, analyzedManeuvers: [{ maneuverId: "m-1", decision: "INSUFFICIENT_EVIDENCE", riskScore: 10, reasons: [], evidence: [], recommendedAction: "NONE" }] };
    expect(isRouteAuditOperationallyComplete("ready", insufficient)).toBe(true);

    const alternative = { ...successfulAudit, requiresHumanReview: false, requiresReplan: false, analyzedManeuvers: [{ maneuverId: "m-1", decision: "CAUTION", riskScore: 75, reasons: [], evidence: ["giro"], recommendedAction: "REQUEST_ALTERNATIVE" }] };
    expect(isRouteAuditEvaluationComplete("ready", alternative)).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", alternative)).toBe(true);
    expect(routeAuditRequiresReplan(alternative)).toBe(false);

    const penalizedSegment = { ...successfulAudit, requiresHumanReview: true, requiresReplan: false, analyzedManeuvers: [{ maneuverId: "m-2", decision: "CAUTION", riskScore: 73, reasons: ["Tramo mejorable"], evidence: ["Valhalla"], recommendedAction: "PENALIZE_SEGMENT" }] };
    expect(isRouteAuditEvaluationComplete("ready", penalizedSegment)).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", penalizedSegment)).toBe(true);
    expect(routeAuditRequiresReplan(penalizedSegment)).toBe(false);
    expect(isRouteAuditOperationallyComplete("ready", { ...penalizedSegment, routeDurationSeconds: 2_999 })).toBe(true);
    expect(routeAuditRequiresReplan({ ...penalizedSegment, routeDurationSeconds: 2_999 })).toBe(false);
    expect(routeAuditRequiresReplan({ ...penalizedSegment, routeDurationSeconds: 3_000 })).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", { ...penalizedSegment, routeDurationSeconds: 3_000 })).toBe(false);
    expect(isRouteAuditOperationallyComplete("ready", { ...penalizedSegment, routeDurationSeconds: 3_001 })).toBe(false);
    const explicitReview = { ...penalizedSegment, analyzedManeuvers: [...penalizedSegment.analyzedManeuvers, { maneuverId: "m-3", decision: "CAUTION", riskScore: 75, reasons: ["Revisar"], evidence: ["IA"], recommendedAction: "HUMAN_REVIEW" }] };
    expect(isRouteAuditOperationallyComplete("ready", explicitReview)).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", { ...explicitReview, routeDurationSeconds: 2_999 })).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", { ...explicitReview, routeDurationSeconds: 3_000 })).toBe(false);
    expect(isRouteAuditOperationallyComplete("ready", { ...explicitReview, routeDurationSeconds: 3_001 })).toBe(false);

    const rejectedUnderThreshold = { ...explicitReview, decision: "REJECT" as const, requiresReplan: true, routeDurationSeconds: 2_999 };
    expect(isRouteAuditEvaluationComplete("ready", rejectedUnderThreshold)).toBe(true);
    expect(routeAuditRequiresReplan(rejectedUnderThreshold)).toBe(false);
    expect(routeAuditRequiresReplan({ ...rejectedUnderThreshold, routeDurationSeconds: 3_000 })).toBe(true);
  });

  it("keeps AI technical errors unavailable regardless of route duration", () => {
    expect(isRouteAuditOperationallyComplete("ready", { ...successfulAudit, routeDurationSeconds: 2_999, decision: "ERROR" })).toBe(false);
    expect(isRouteAuditOperationallyComplete("error", { ...successfulAudit, routeDurationSeconds: 2_999 })).toBe(false);
  });

  it.each([
    ["loading", successfulAudit],
    ["error", successfulAudit],
    ["ready", null],
    ["ready", { ...successfulAudit, mode: "OFF" }],
    ["ready", { ...successfulAudit, provider: "none" }],
    ["ready", { ...successfulAudit, runId: null }],
    ["ready", { ...successfulAudit, decision: "ERROR" }],
    ["ready", { ...successfulAudit, routeDurationSeconds: 3_000, decision: "REJECT" }],
    ["ready", { ...successfulAudit, routeDurationSeconds: 3_000, requiresReplan: true }],
    ["ready", { ...successfulAudit, routeDurationSeconds: 3_000, requiresReplan: true }],
    ["ready", { ...successfulAudit, auditedManeuverCount: 0 }]
  ] as const)("keeps an unverified route unavailable (%s)", (status, audit) => {
    expect(isRouteAuditOperationallyComplete(status, audit, true)).toBe(false);
  });
});
