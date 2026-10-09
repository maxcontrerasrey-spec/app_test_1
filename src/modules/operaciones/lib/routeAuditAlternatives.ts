import { calculateAtlasValhallaRoute, type AtlasManeuverAvoidanceTarget, type AtlasOptimizedRoute, type AtlasPlannedRoute, type AtlasRouteAuditResponse } from "../services/atlasOperationsApi";
import type { OrderedRouteCandidate } from "./auditedRouteSearch";

export type AuditedRouteProposal<TStop extends { lat: number; lng: number } = { lat: number; lng: number }> = { stops: TStop[]; route: AtlasOptimizedRoute };
export const MAX_OPERATIONALLY_VIABLE_ROUTE_SECONDS = 50 * 60;

export function auditManeuverAvoidanceTargets(audit: AtlasRouteAuditResponse, route: AtlasPlannedRoute): AtlasManeuverAvoidanceTarget[] {
  const targetedIds = new Set(audit.analyzedManeuvers
    .filter((item) => item.decision === "REJECT" || ["BLOCK_MANEUVER", "PENALIZE_SEGMENT", "REQUEST_ALTERNATIVE"].includes(String(item.recommendedAction)))
    .map((item) => String(item.maneuverId)));
  return (route.maneuvers ?? [])
    .filter((maneuver) => targetedIds.has(maneuver.maneuverId)
      && maneuver.routeLegIndex !== null
      && maneuver.latitude !== null
      && maneuver.longitude !== null)
    .slice(0, 6)
    .map((maneuver) => ({ routeLegIndex: maneuver.routeLegIndex!, latitude: maneuver.latitude!, longitude: maneuver.longitude! }));
}

export function routeGeometrySignature(route: AtlasPlannedRoute) {
  return route.coordinates.map(([longitude, latitude]) => `${longitude.toFixed(6)},${latitude.toFixed(6)}`).join(";");
}

/** Re-route the same stop order around AI-flagged edges; accept faster traces or bounded detours under 50 minutes. */
export async function findFasterTargetedRouteAlternative<TStop extends { lat: number; lng: number }>(
  currentCandidate: AuditedRouteProposal<TStop>,
  currentAudit: AtlasRouteAuditResponse,
  plannedVehicleType: string
): Promise<OrderedRouteCandidate<AuditedRouteProposal<TStop>> | null> {
  const avoidManeuvers = auditManeuverAvoidanceTargets(currentAudit, currentCandidate.route);
  if (!avoidManeuvers.length) return null;
  try {
    const rerouted = await calculateAtlasValhallaRoute(
      currentCandidate.stops.map(({ lat, lng }) => ({ lat, lng })),
      plannedVehicleType,
      undefined,
      avoidManeuvers
    );
    const changedGeometry = routeGeometrySignature(rerouted) !== routeGeometrySignature(currentCandidate.route);
    const faster = rerouted.durationSeconds < currentCandidate.route.durationSeconds
      || rerouted.durationSeconds === currentCandidate.route.durationSeconds && rerouted.distanceMeters < currentCandidate.route.distanceMeters;
    const withinDetourAllowance = rerouted.durationSeconds <= currentCandidate.route.durationSeconds + Math.min(180, currentCandidate.route.durationSeconds * 0.15);
    const operationallyViable = rerouted.durationSeconds < MAX_OPERATIONALLY_VIABLE_ROUTE_SECONDS;
    if (rerouted.targetedAvoidance?.status !== "APPLIED" || !changedGeometry || !(faster || (withinDetourAllowance && operationallyViable))) return null;
    return {
      value: { stops: currentCandidate.stops, route: { ...currentCandidate.route, ...rerouted } },
      order: currentCandidate.route.order
    };
  } catch {
    // A failed or unsupported targeted route falls through to the stop-order search.
    return null;
  }
}
