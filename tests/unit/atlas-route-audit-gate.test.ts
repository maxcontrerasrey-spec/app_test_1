import { describe, expect, it } from "vitest";
import { isRouteAuditEvaluationComplete, isRouteAuditOperationallyComplete } from "../../src/modules/operaciones/components/AtlasRouteAuditPanel";
import type { AtlasRouteAuditResponse } from "../../src/modules/operaciones/services/atlasOperationsApi";

const successfulAudit: AtlasRouteAuditResponse = {
  decision: "WARNING", riskScore: 25, summary: "Revisión operacional recomendada", analyzedManeuvers: [],
  requiresReplan: false, requiresHumanReview: true, runId: "run-1", mode: "SHADOW", provider: "openai", auditedManeuverCount: 2
};

describe("Atlas mandatory route audit gate", () => {
  it("requires a positive human review when the audit asks for one", () => {
    expect(isRouteAuditEvaluationComplete("ready", successfulAudit)).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", successfulAudit)).toBe(false);
    expect(isRouteAuditOperationallyComplete("ready", successfulAudit, true)).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", successfulAudit, false)).toBe(false);
  });

  it("allows an audited proposal without extra feedback when human review is not requested", () => {
    expect(isRouteAuditOperationallyComplete("ready", { ...successfulAudit, requiresHumanReview: false })).toBe(true);
  });

  it("derives a human-review gate from insufficient evidence even when the summary flag is false", () => {
    const contradictory = { ...successfulAudit, requiresHumanReview: false, decision: "INSUFFICIENT_EVIDENCE" as const };
    expect(isRouteAuditEvaluationComplete("ready", contradictory)).toBe(true);
    expect(isRouteAuditOperationallyComplete("ready", contradictory)).toBe(false);
    expect(isRouteAuditOperationallyComplete("ready", contradictory, true)).toBe(true);
  });

  it("derives review and replan gates from maneuver decisions and recommended actions", () => {
    const insufficient = { ...successfulAudit, requiresHumanReview: false, analyzedManeuvers: [{ maneuverId: "m-1", decision: "INSUFFICIENT_EVIDENCE", riskScore: 10, reasons: [], evidence: [], recommendedAction: "NONE" }] };
    expect(isRouteAuditOperationallyComplete("ready", insufficient)).toBe(false);
    expect(isRouteAuditOperationallyComplete("ready", insufficient, true)).toBe(true);

    const alternative = { ...successfulAudit, requiresHumanReview: false, requiresReplan: false, analyzedManeuvers: [{ maneuverId: "m-1", decision: "CAUTION", riskScore: 75, reasons: [], evidence: ["giro"], recommendedAction: "REQUEST_ALTERNATIVE" }] };
    expect(isRouteAuditEvaluationComplete("ready", alternative)).toBe(false);
    expect(isRouteAuditOperationallyComplete("ready", alternative, true)).toBe(false);

    const penalizedSegment = { ...successfulAudit, requiresHumanReview: false, requiresReplan: false, analyzedManeuvers: [{ maneuverId: "m-2", decision: "CAUTION", riskScore: 73, reasons: ["Tramo mejorable"], evidence: ["Valhalla"], recommendedAction: "PENALIZE_SEGMENT" }] };
    expect(isRouteAuditEvaluationComplete("ready", penalizedSegment)).toBe(false);
    expect(isRouteAuditOperationallyComplete("ready", penalizedSegment, true)).toBe(false);
  });

  it.each([
    ["loading", successfulAudit],
    ["error", successfulAudit],
    ["ready", null],
    ["ready", { ...successfulAudit, mode: "OFF" }],
    ["ready", { ...successfulAudit, provider: "none" }],
    ["ready", { ...successfulAudit, runId: null }],
    ["ready", { ...successfulAudit, decision: "ERROR" }],
    ["ready", { ...successfulAudit, decision: "REJECT" }],
    ["ready", { ...successfulAudit, requiresReplan: true }],
    ["ready", { ...successfulAudit, auditedManeuverCount: 0 }]
  ] as const)("keeps an unverified route unavailable (%s)", (status, audit) => {
    expect(isRouteAuditOperationallyComplete(status, audit, true)).toBe(false);
  });
});
