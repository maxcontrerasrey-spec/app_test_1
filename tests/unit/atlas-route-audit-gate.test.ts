import { describe, expect, it } from "vitest";
import { isRouteAuditOperationallyComplete } from "../../src/modules/operaciones/components/AtlasRouteAuditPanel";
import type { AtlasRouteAuditResponse } from "../../src/modules/operaciones/services/atlasOperationsApi";

const successfulAudit: AtlasRouteAuditResponse = {
  decision: "WARNING", riskScore: 25, summary: "Revisión operacional recomendada", analyzedManeuvers: [],
  requiresReplan: false, requiresHumanReview: true, runId: "run-1", mode: "SHADOW", provider: "openai", auditedManeuverCount: 2
};

describe("Atlas mandatory route audit gate", () => {
  it("allows an audited proposal only after a persisted OpenAI evaluation inspected maneuvers", () => {
    expect(isRouteAuditOperationallyComplete("ready", successfulAudit)).toBe(true);
  });

  it.each([
    ["loading", successfulAudit],
    ["off", successfulAudit],
    ["error", successfulAudit],
    ["ready", null],
    ["ready", { ...successfulAudit, mode: "OFF" }],
    ["ready", { ...successfulAudit, provider: "none" }],
    ["ready", { ...successfulAudit, runId: null }],
    ["ready", { ...successfulAudit, decision: "ERROR" }],
    ["ready", { ...successfulAudit, auditedManeuverCount: 0 }]
  ] as const)("keeps an unverified route unavailable (%s)", (status, audit) => {
    expect(isRouteAuditOperationallyComplete(status, audit)).toBe(false);
  });
});
