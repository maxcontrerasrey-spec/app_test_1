import type { AtlasRouteAuditResponse } from "../services/atlasOperationsApi";

export type RouteAuditFeedbackType = "ACCEPT_AI" | "OVERRIDE_FEASIBLE" | "OVERRIDE_NOT_FEASIBLE" | "INSUFFICIENT_INFORMATION";

export function routeAuditNeedsHumanReview(audit: AtlasRouteAuditResponse | null) {
  return Boolean(audit && (
    audit.requiresHumanReview
    || audit.decision === "INSUFFICIENT_EVIDENCE"
    || audit.analyzedManeuvers.some((item) => item.decision === "INSUFFICIENT_EVIDENCE" || item.decision === "REJECT"
      || ["HUMAN_REVIEW", "PENALIZE_SEGMENT", "BLOCK_MANEUVER", "REQUEST_ALTERNATIVE"].includes(String(item.recommendedAction)))
  ));
}

export function routeAuditRequiresReplan(audit: AtlasRouteAuditResponse | null) {
  return Boolean(audit && (audit.requiresReplan || audit.decision === "REJECT"
    || audit.analyzedManeuvers.some((item) => item.decision === "REJECT" || ["BLOCK_MANEUVER", "REQUEST_ALTERNATIVE"].includes(String(item.recommendedAction)))));
}

export function isRouteAuditEvaluationComplete(status: "idle" | "loading" | "ready" | "error", audit: AtlasRouteAuditResponse | null) {
  return status === "ready"
    && audit !== null
    && audit.mode === "SHADOW"
    && audit.provider === "openai"
    && Boolean(audit.runId)
    && audit.decision !== "ERROR"
    && audit.decision !== "REJECT"
    && !routeAuditRequiresReplan(audit)
    && (audit.auditedManeuverCount ?? 0) > 0;
}

export function isRouteAuditOperationallyComplete(status: "idle" | "loading" | "ready" | "error", audit: AtlasRouteAuditResponse | null, humanReviewAccepted = false) {
  return isRouteAuditEvaluationComplete(status, audit)
    && (!routeAuditNeedsHumanReview(audit) || humanReviewAccepted);
}

export function auditDecisionLabel(decision: AtlasRouteAuditResponse["decision"]) {
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
  alternativeAttempted,
  onRequestAlternative,
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
  alternativeAttempted: boolean;
  onRequestAlternative: () => void;
  onFeedbackTypeChange: (value: RouteAuditFeedbackType) => void;
  onFeedbackReasonChange: (value: string) => void;
  onSubmitFeedback: () => void;
}) {
  return <section className="ops-route-demo__message ops-route-demo__route-audit" aria-live="polite">
    <strong>Route Intelligence · revisión con IA</strong>
    {status === "loading" && <p>La IA está evaluando esta ruta. No se puede aplicar ni guardar hasta completar la revisión.</p>}
    {status === "error" && <p role="alert">{error}</p>}
    {audit && <>
      <p><b>{auditDecisionLabel(audit.decision)}</b>{audit.riskScore === null ? " · sin puntaje" : ` · indicador ${audit.riskScore}/100`}{routeAuditNeedsHumanReview(audit) ? " · requiere revisión humana" : ""}</p>
      <p>{audit.summary}</p>
      {routeAuditRequiresReplan(audit) && <>
        <p role="alert">La IA marcó una maniobra que requiere cambiar el recorrido. Puedes buscar otra secuencia automáticamente; se mantienen las mismas direcciones y destino. El feedback no habilita esta ruta.</p>
        {!alternativeAttempted
          ? <button type="button" className="ops-route-demo__secondary" onClick={onRequestAlternative} disabled={alternativeLoading}>
            {alternativeLoading ? "Buscando otra secuencia…" : "Buscar alternativa automática"}
          </button>
          : <p role="status">Ya se evaluó una alternativa adicional en este intento. Si la IA sigue solicitando un cambio, la propuesta permanece bloqueada porque no se verificó una secuencia utilizable.</p>}
      </>}
      {routeAuditNeedsHumanReview(audit) && !routeAuditRequiresReplan(audit) && !feedbackSaved && <p role="status">La evidencia no es suficiente para liberar la ruta automáticamente. Revisa el caso y registra una evaluación positiva para habilitar aplicar, guardar o probar la navegación.</p>}
      <small>
        {audit.decision === "ERROR" || audit.provider !== "openai"
          ? "No se completó la evaluación de IA."
          : `GPT-6 Luna · ${audit.latencyMs ?? 0} ms · ${audit.auditedManeuverCount ?? 0} de ${audit.totalManeuverCount ?? 0} maniobras evaluadas (${audit.evaluationScope === "RISK_PRIORITIZED_SAMPLE" ? "priorizadas por riesgo" : "muestra distribuida en todo el recorrido"})`}. La IA revisa cada ruta propuesta, pero no cambia su trazado en modo sombra ni garantiza una mejora cuando no existe una alternativa comprobable. {audit.vehicleProfileVerified ? "Perfil dimensional verificado." : "Sin dimensiones verificadas; no se certifica viabilidad física."}
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
