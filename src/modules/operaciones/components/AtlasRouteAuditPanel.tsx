import type { AtlasRouteAuditResponse } from "../services/atlasOperationsApi";

export type RouteAuditFeedbackType = "ACCEPT_AI" | "OVERRIDE_FEASIBLE" | "OVERRIDE_NOT_FEASIBLE" | "INSUFFICIENT_INFORMATION";

function routeIsUnderOperationalThreshold(audit: AtlasRouteAuditResponse) {
  return Number.isFinite(audit.routeDurationSeconds) && audit.routeDurationSeconds < 3_000;
}

export function routeAuditNeedsHumanReview(audit: AtlasRouteAuditResponse | null) {
  if (!audit) return false;
  if (routeIsUnderOperationalThreshold(audit)) return false;
  const hasInsufficientEvidence = audit.decision === "INSUFFICIENT_EVIDENCE"
    || audit.analyzedManeuvers.some((item) => item.decision === "INSUFFICIENT_EVIDENCE");
  const hasHardFinding = audit.decision === "REJECT" || audit.requiresReplan
    || audit.analyzedManeuvers.some((item) => item.decision === "REJECT"
      || ["HUMAN_REVIEW", "BLOCK_MANEUVER", "REQUEST_ALTERNATIVE"].includes(String(item.recommendedAction)));
  const hasSoftPenalty = audit.analyzedManeuvers.some((item) => item.recommendedAction === "PENALIZE_SEGMENT");
  return hasInsufficientEvidence || hasHardFinding || audit.requiresHumanReview || hasSoftPenalty;
}

export function routeAuditRequiresReplan(audit: AtlasRouteAuditResponse | null) {
  if (!audit || routeIsUnderOperationalThreshold(audit)) return false;
  return Boolean(audit.requiresReplan || audit.decision === "REJECT"
    || audit.analyzedManeuvers.some((item) => item.decision === "REJECT" || ["BLOCK_MANEUVER", "REQUEST_ALTERNATIVE", "PENALIZE_SEGMENT"].includes(String(item.recommendedAction))));
}

/** A viable route can still trigger an automatic search for an AI-recommended improvement. */
export function routeAuditSuggestsAlternative(audit: AtlasRouteAuditResponse | null) {
  if (!audit) return false;
  return Boolean(audit.requiresReplan || audit.decision === "REJECT"
    || audit.analyzedManeuvers.some((item) => item.decision === "REJECT" || ["BLOCK_MANEUVER", "REQUEST_ALTERNATIVE", "PENALIZE_SEGMENT"].includes(String(item.recommendedAction))));
}

export function isRouteAuditEvaluationComplete(status: "idle" | "loading" | "ready" | "error", audit: AtlasRouteAuditResponse | null) {
  return status === "ready"
    && audit !== null
    && audit.mode === "SHADOW"
    && audit.provider === "openai"
    && Number.isFinite(audit.routeDurationSeconds)
    && audit.routeDurationSeconds >= 0
    && Boolean(audit.runId)
    && audit.decision !== "ERROR"
    && (routeIsUnderOperationalThreshold(audit) || audit.decision !== "REJECT" && !routeAuditRequiresReplan(audit))
    && (audit.auditedManeuverCount ?? 0) > 0;
}

export function isRouteAuditOperationallyComplete(status: "idle" | "loading" | "ready" | "error", audit: AtlasRouteAuditResponse | null, humanReviewAccepted = false) {
  return isRouteAuditEvaluationComplete(status, audit)
    && (!routeAuditNeedsHumanReview(audit) || humanReviewAccepted);
}

export function auditDecisionLabel(decision: AtlasRouteAuditResponse["decision"], shortRoute = false) {
  if (shortRoute && decision === "REJECT") return "Observación IA registrada · recomendación no bloqueante";
  if (shortRoute && decision === "INSUFFICIENT_EVIDENCE") return "Evaluación IA registrada · evidencia limitada";
  return ({
    APPROVE: "Sin alertas en las maniobras revisadas",
    WARNING: "Revisión operacional recomendada",
    REJECT: "El auditor detectó un riesgo que requiere revisión",
    INSUFFICIENT_EVIDENCE: "Evidencia insuficiente para evaluar viabilidad",
    ERROR: "No se pudo completar la auditoría",
  })[decision];
}

export function AtlasRouteAuditPanel({
  status,
  audit,
  error,
  feedbackType,
  feedbackReason,
  feedbackSaving,
  feedbackSaved,
  alternativeLoading,
  alternativeAttempts,
  alternativeSearchComplete,
  onRetryAudit,
  onFeedbackTypeChange,
  onFeedbackReasonChange,
  onSubmitFeedback,
}: {
  status: "loading" | "ready" | "error";
  audit: AtlasRouteAuditResponse | null;
  error: string;
  feedbackType: RouteAuditFeedbackType;
  feedbackReason: string;
  feedbackSaving: boolean;
  feedbackSaved: boolean;
  alternativeLoading: boolean;
  alternativeAttempts: number;
  alternativeSearchComplete: boolean;
  onRetryAudit: () => void;
  onFeedbackTypeChange: (value: RouteAuditFeedbackType) => void;
  onFeedbackReasonChange: (value: string) => void;
  onSubmitFeedback: () => void;
}) {
  return <section className="ops-route-demo__message ops-route-demo__route-audit" aria-live="polite">
    <strong>Route Intelligence · revisión con IA</strong>
    {status === "loading" && <p>La IA está evaluando esta ruta. No se puede aplicar ni guardar hasta completar la revisión.</p>}
    {status === "error" && <><p role="alert">{error}</p><button type="button" className="ops-route-demo__secondary" onClick={onRetryAudit}>Reintentar evaluación IA de esta misma ruta</button></>}
    {audit && <>
      <p><b>{auditDecisionLabel(audit.decision, routeIsUnderOperationalThreshold(audit))}</b>{audit.riskScore === null ? " · sin puntaje" : ` · indicador ${audit.riskScore}/100`}{routeAuditNeedsHumanReview(audit) ? " · requiere revisión humana" : ""}</p>
      <p>{audit.summary}</p>
      {routeIsUnderOperationalThreshold(audit) && <p role="status">Recorrido viable por regla operacional (&lt;50 min). La evaluación IA queda registrada; sus observaciones no exigen cambiar puntos ni bloquean el uso.</p>}
      {routeAuditSuggestsAlternative(audit) && <>
        <p role={routeIsUnderOperationalThreshold(audit) ? "status" : "alert"}>{routeIsUnderOperationalThreshold(audit)
          ? "La IA sugiere una mejora. El sistema probará alternativas automáticamente y las volverá a evaluar; si no encuentra una mejor, conservará esta ruta completa sin pedirte cambiar los puntos."
          : "La IA marcó una maniobra que requiere revisar el trazado. El sistema intenta rodear ese tramo y, si no mejora la ruta, prueba otras secuencias con las mismas direcciones, destino y tipo de equipo. Cada alternativa debe volver a pasar por IA antes de usarse."}</p>
        {alternativeLoading
          ? <p role="status">Buscando la alternativa {alternativeAttempts} de 2 y volviendo a evaluarla con IA…</p>
          : alternativeSearchComplete
            ? <p role="status">{routeIsUnderOperationalThreshold(audit)
              ? `Se evaluaron ${alternativeAttempts} alternativa(s) automáticamente. Se conserva la mejor ruta completa auditada bajo 50 min; no necesitas cambiar puntos.`
              : `Sin ruta aprobable tras ${alternativeAttempts} alternativas; propuesta bloqueada.`}</p>
            : null}
      </>}
      <small>
        {audit.decision === "ERROR" || audit.provider !== "openai"
          ? "No se completó la evaluación de IA."
          : `GPT-6 Luna · ${audit.latencyMs ?? 0} ms · ${audit.auditedManeuverCount ?? 0} de ${audit.totalManeuverCount ?? 0} maniobras evaluadas (${audit.evaluationScope === "RISK_PRIORITIZED_SAMPLE" ? "priorizadas por riesgo" : "muestra distribuida en todo el recorrido"})`}. La IA identifica y prioriza maniobras; Valhalla calcula y valida la geometría. La revisión no certifica espacio físico, maniobras reales ni seguridad del cruce. {audit.vehicleProfileVerified ? "Perfil dimensional verificado." : "Sin dimensiones verificadas; no se certifica viabilidad física."}
      </small>
      {audit.analyzedManeuvers.length > 0 && <ul>{audit.analyzedManeuvers.map((item, index) => {
        const maneuver = item as Record<string, unknown>;
        const reasons = Array.isArray(maneuver.reasons) ? maneuver.reasons.join("; ") : "";
        return <li key={`${String(maneuver.maneuverId)}-${index}`}>{String(maneuver.maneuverId)} · {String(maneuver.decision)} · {reasons}</li>;
      })}</ul>}
      {audit.runId && <div className="ops-route-demo__audit-feedback">
        <label>Tu evaluación
          <select value={feedbackType} onChange={(event) => onFeedbackTypeChange(event.target.value as RouteAuditFeedbackType)} disabled={feedbackSaving || feedbackSaved}>
            <option value="ACCEPT_AI">{routeAuditNeedsHumanReview(audit) ? "Confirmo revisión y continuar" : "Acepto la evaluación"}</option>
            <option value="OVERRIDE_FEASIBLE">Override: ruta viable</option>
            <option value="OVERRIDE_NOT_FEASIBLE">Override: ruta no viable</option>
            <option value="INSUFFICIENT_INFORMATION">Falta información</option>
          </select>
        </label>
        {feedbackType !== "ACCEPT_AI" && <label>Motivo
          <textarea value={feedbackReason} onChange={(event) => onFeedbackReasonChange(event.target.value)} maxLength={2000} rows={2} placeholder="Describe la evidencia operacional observada." disabled={feedbackSaving || feedbackSaved} />
        </label>}
        <button type="button" className="ops-route-demo__secondary" onClick={onSubmitFeedback} disabled={feedbackSaving || feedbackSaved || (feedbackType !== "ACCEPT_AI" && feedbackReason.trim().length < 5)}>
          {feedbackSaved ? "Feedback registrado" : feedbackSaving ? "Guardando..." : "Registrar feedback"}
        </button>
      </div>}
    </>}
    {error && status !== "error" && <p role="alert">{error}</p>}
  </section>;
}
