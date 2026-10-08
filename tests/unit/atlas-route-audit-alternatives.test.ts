import { describe, expect, it } from "vitest";
import { auditManeuverAvoidanceTargets } from "../../src/modules/operaciones/lib/routeAuditAlternatives";
import type { AtlasOptimizedRoute, AtlasRouteAuditResponse } from "../../src/modules/operaciones/services/atlasOperationsApi";

const route = {
  coordinates: [[-68.93, -22.45], [-68.929, -22.451]], distanceMeters: 100, durationSeconds: 30,
  provider: "valhalla", travelMode: "bus", order: [0, 1], matrixDurationSeconds: 30,
  optimizationMethod: "valhalla_matrix_open_path_v2",
  maneuvers: [
    { maneuverId: "m-001", latitude: -22.45, longitude: -68.93, routeLegIndex: 0 },
    { maneuverId: "m-002", latitude: -22.451, longitude: -68.929, routeLegIndex: 0 },
    { maneuverId: "m-003", latitude: null, longitude: null, routeLegIndex: null }
  ]
} as unknown as AtlasOptimizedRoute;

function audit(analyzedManeuvers: Array<Record<string, unknown>>): AtlasRouteAuditResponse {
  return { decision: "WARNING", riskScore: 70, summary: "Revisar", analyzedManeuvers, requiresReplan: true, requiresHumanReview: true, runId: "run-1", mode: "SHADOW" };
}

describe("AI-targeted Atlas route alternatives", () => {
  it("maps only validated AI maneuver IDs to coordinates from the audited Valhalla snapshot", () => {
    expect(auditManeuverAvoidanceTargets(audit([
      { maneuverId: "m-002", decision: "CAUTION", recommendedAction: "PENALIZE_SEGMENT" },
      { maneuverId: "m-404", decision: "REJECT", recommendedAction: "BLOCK_MANEUVER" },
      { maneuverId: "m-003", decision: "REJECT", recommendedAction: "REQUEST_ALTERNATIVE" }
    ]), route)).toEqual([{ routeLegIndex: 0, latitude: -22.451, longitude: -68.929 }]);
  });

  it("does not target ordinary human-review findings without a maneuver change request", () => {
    expect(auditManeuverAvoidanceTargets(audit([
      { maneuverId: "m-001", decision: "CAUTION", recommendedAction: "HUMAN_REVIEW" }
    ]), route)).toEqual([]);
  });
});
