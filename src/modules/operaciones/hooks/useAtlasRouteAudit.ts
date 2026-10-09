import { useCallback, useRef, useState } from "react";
import { auditAtlasRouteIntelligence, recordAtlasRouteIntelligenceFeedback, type AtlasPlannedRoute, type AtlasRouteAuditResponse } from "../services/atlasOperationsApi";
import { isRouteAuditEvaluationComplete, isRouteAuditOperationallyComplete, type RouteAuditFeedbackType } from "../components/AtlasRouteAuditPanel";

type RouteAuditRequest = {
  route: AtlasPlannedRoute;
  stops: Array<{ lat: number; lng: number }>;
  vehicleType: string;
  vehicleId: string | null;
  serviceRouteId: string | null;
  routeKind: "OPTIMIZED_PROPOSAL" | "SAVED_ROUTE_PREVIEW" | "DRIVER_SIMULATION";
  serviceTemplateId: number | null;
  bindAsPlanningAudit: boolean;
};

export function useAtlasRouteAudit(plannedVehicleType: string, selectedServiceId: string, auditVehicleId: string) {
  const [routeAudit, setRouteAudit] = useState<AtlasRouteAuditResponse | null>(null);
  const [planningAudit, setPlanningAudit] = useState<AtlasRouteAuditResponse | null>(null);
  const [routeAuditStatus, setRouteAuditStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [routeAuditError, setRouteAuditError] = useState("");
  const [auditFeedbackType, setAuditFeedbackType] = useState<RouteAuditFeedbackType>("ACCEPT_AI");
  const [auditFeedbackReason, setAuditFeedbackReason] = useState("");
  const [auditFeedbackSaved, setAuditFeedbackSaved] = useState(false);
  const [auditFeedbackSaving, setAuditFeedbackSaving] = useState(false);
  const [alternativeLoading, setAlternativeLoading] = useState(false);
  const [alternativeAttempts, setAlternativeAttempts] = useState(0);
  const [alternativeSearchComplete, setAlternativeSearchComplete] = useState(false);
  const sequence = useRef(0);
  const lastRequest = useRef<RouteAuditRequest | null>(null);
  const canUseAuditedRoute = isRouteAuditOperationallyComplete(
    routeAuditStatus,
    routeAudit,
    auditFeedbackSaved && (auditFeedbackType === "ACCEPT_AI" || auditFeedbackType === "OVERRIDE_FEASIBLE")
  );

  const reset = useCallback(() => {
    sequence.current += 1;
    lastRequest.current = null;
    setRouteAudit(null);
    setPlanningAudit(null);
    setRouteAuditStatus("idle");
    setRouteAuditError("");
    setAuditFeedbackSaved(false);
    setAlternativeLoading(false);
    setAlternativeAttempts(0);
    setAlternativeSearchComplete(false);
  }, []);

  async function evaluateRouteAudit(
    candidate: AtlasPlannedRoute,
    candidateStops: Array<{ lat: number; lng: number }>,
    vehicleType = plannedVehicleType,
    serviceRouteId: string | null = null,
    routeKind: RouteAuditRequest["routeKind"] = "OPTIMIZED_PROPOSAL",
    serviceTemplateId = Number(selectedServiceId) || null,
    vehicleId: string | null = auditVehicleId || null,
    bindAsPlanningAudit = true
  ) {
    const requestId = ++sequence.current;
    lastRequest.current = { route: candidate, stops: candidateStops.map(({ lat, lng }) => ({ lat, lng })), vehicleType, vehicleId, serviceRouteId, routeKind, serviceTemplateId, bindAsPlanningAudit };
    setRouteAudit(null);
    setRouteAuditError("");
    setRouteAuditStatus("loading");
    try {
      const audit = await auditAtlasRouteIntelligence(candidate, candidateStops, serviceTemplateId, vehicleId, vehicleType, { serviceRouteId, routeKind });
      if (sequence.current !== requestId) return null;
      setRouteAudit(audit);
      const persisted = Boolean(audit.runId && audit.mode === "SHADOW" && audit.provider === "openai" && audit.decision !== "ERROR" && (audit.auditedManeuverCount ?? 0) > 0);
      setRouteAuditStatus(persisted ? "ready" : "error");
      if (!persisted) setRouteAuditError(audit.summary || "La auditoría IA no terminó de forma verificable; vuelve a intentarlo.");
      return audit;
    } catch (reason) {
      if (sequence.current !== requestId) return null;
      setRouteAuditError(reason instanceof Error ? reason.message : "No fue posible completar la auditoría de ruta.");
      setRouteAuditStatus("error");
      return null;
    }
  }

  function retryRouteAudit() {
    const request = lastRequest.current;
    if (!request || routeAuditStatus === "loading") return;
    setAuditFeedbackSaved(false);
    void evaluateRouteAudit(request.route, request.stops, request.vehicleType, request.serviceRouteId, request.routeKind, request.serviceTemplateId, request.vehicleId, request.bindAsPlanningAudit).then((audit) => {
      if (audit && request.bindAsPlanningAudit && isRouteAuditEvaluationComplete("ready", audit)) setPlanningAudit(audit);
    });
  }

  async function submitRouteAuditFeedback() {
    if (!routeAudit?.runId || auditFeedbackSaving) return;
    setAuditFeedbackSaving(true);
    try {
      await recordAtlasRouteIntelligenceFeedback(routeAudit.runId, auditFeedbackType, auditFeedbackReason.trim());
      setAuditFeedbackSaved(true);
      setRouteAuditError("");
    } catch (reason) {
      setRouteAuditError(reason instanceof Error ? reason.message : "No fue posible guardar el feedback.");
    } finally {
      setAuditFeedbackSaving(false);
    }
  }

  return {
    routeAudit, planningAudit, setPlanningAudit, routeAuditStatus, routeAuditError,
    auditFeedbackType, setAuditFeedbackType, auditFeedbackReason, setAuditFeedbackReason,
    auditFeedbackSaved, setAuditFeedbackSaved, auditFeedbackSaving, alternativeLoading, setAlternativeLoading,
    alternativeAttempts, setAlternativeAttempts, alternativeSearchComplete, setAlternativeSearchComplete,
    canUseAuditedRoute, reset, evaluateRouteAudit, retryRouteAudit, submitRouteAuditFeedback
  };
}
