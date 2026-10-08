export const MAX_AUTOMATIC_ROUTE_ALTERNATIVES = 2;

export type OrderedRouteCandidate<T> = { value: T; order: number[] };

export type AuditedRouteSearchResult<TCandidate, TAudit> = {
  status: "accepted" | "audit_error" | "alternative_error" | "alternatives_exhausted" | "stale";
  candidate: TCandidate;
  audit: TAudit | null;
  auditAttempts: number;
  alternativeAttempts: number;
  error?: string;
};

/** Audits each candidate before considering another order; all orders share the original stop identities. */
export async function searchAuditedRoute<TCandidate, TAudit>(
  initial: OrderedRouteCandidate<TCandidate>,
  options: {
    maxAlternatives?: number;
    audit: (candidate: TCandidate) => Promise<TAudit | null>;
    requiresReplan: (audit: TAudit) => boolean;
    hasPersistedEvaluation: (audit: TAudit) => boolean;
    findAlternative: (excludedOrders: number[][]) => Promise<OrderedRouteCandidate<TCandidate> | null>;
    onCandidate?: (candidate: TCandidate, auditAttempt: number) => void;
    onAlternativeSearch?: (alternativeAttempt: number) => void;
    getErrorMessage?: (reason: unknown) => string;
  }
): Promise<AuditedRouteSearchResult<TCandidate, TAudit>> {
  const maxAlternatives = Math.max(0, Math.min(options.maxAlternatives ?? MAX_AUTOMATIC_ROUTE_ALTERNATIVES, 4));
  const excludedOrders = [initial.order];
  let candidate = initial.value;
  let audit: TAudit | null = null;
  let auditAttempts = 0;
  let alternativeAttempts = 0;

  while (true) {
    options.onCandidate?.(candidate, auditAttempts + 1);
    try {
      auditAttempts += 1;
      audit = await options.audit(candidate);
    } catch (reason) {
      return { status: "audit_error", candidate, audit, auditAttempts, alternativeAttempts, error: options.getErrorMessage?.(reason) };
    }

    if (audit === null) return { status: "stale", candidate, audit, auditAttempts, alternativeAttempts };
    if (!options.hasPersistedEvaluation(audit)) {
      return { status: "audit_error", candidate, audit, auditAttempts, alternativeAttempts };
    }
    if (!options.requiresReplan(audit)) {
      return { status: "accepted", candidate, audit, auditAttempts, alternativeAttempts };
    }
    if (alternativeAttempts >= maxAlternatives) {
      return { status: "alternatives_exhausted", candidate, audit, auditAttempts, alternativeAttempts };
    }

    alternativeAttempts += 1;
    options.onAlternativeSearch?.(alternativeAttempts);
    try {
      const alternative = await options.findAlternative(excludedOrders.map((order) => [...order]));
      if (!alternative) return { status: "alternatives_exhausted", candidate, audit, auditAttempts, alternativeAttempts };
      if (excludedOrders.some((order) => order.join(",") === alternative.order.join(","))) {
        return { status: "alternative_error", candidate, audit, auditAttempts, alternativeAttempts, error: "El optimizador devolvió una secuencia ya evaluada." };
      }
      excludedOrders.push(alternative.order);
      candidate = alternative.value;
    } catch (reason) {
      const message = options.getErrorMessage?.(reason);
      if (message?.includes("route_alternative_exhausted")) {
        return { status: "alternatives_exhausted", candidate, audit, auditAttempts, alternativeAttempts };
      }
      return {
        status: "alternative_error", candidate, audit, auditAttempts, alternativeAttempts,
        error: message
      };
    }
  }
}
