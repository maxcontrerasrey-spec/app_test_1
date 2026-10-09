export const MAX_AUTOMATIC_ROUTE_ALTERNATIVES = 2;

export type OrderedRouteCandidate<T> = { value: T; order: number[] };

export type AuditedRouteSearchResult<TCandidate, TAudit> = {
  status: "accepted" | "audit_error" | "alternative_error" | "alternatives_exhausted" | "stale";
  candidate: TCandidate;
  audit: TAudit | null;
  auditAttempts: number;
  alternativeAttempts: number;
  error?: string;
  viableFallback?: boolean;
};

/** Audits every distinct path before considering another order; all candidates share the original stop identities. */
export async function searchAuditedRoute<TCandidate, TAudit>(
  initial: OrderedRouteCandidate<TCandidate>,
  options: {
    maxAlternatives?: number;
    audit: (candidate: TCandidate) => Promise<TAudit | null>;
    requiresReplan: (audit: TAudit) => boolean;
    selectViableFallback?: (evaluated: Array<{ candidate: TCandidate; order: number[]; audit: TAudit }>) => { candidate: TCandidate; audit: TAudit } | null;
    hasPersistedEvaluation: (audit: TAudit) => boolean;
    findAlternative: (excludedOrders: number[][], currentCandidate: TCandidate, currentAudit: TAudit) => Promise<OrderedRouteCandidate<TCandidate> | null>;
    isDuplicateCandidate?: (left: OrderedRouteCandidate<TCandidate>, right: OrderedRouteCandidate<TCandidate>) => boolean;
    onCandidate?: (candidate: TCandidate, auditAttempt: number) => void;
    onAlternativeSearch?: (alternativeAttempt: number) => void;
    getErrorMessage?: (reason: unknown) => string;
  }
): Promise<AuditedRouteSearchResult<TCandidate, TAudit>> {
  const maxAlternatives = Math.max(0, Math.min(options.maxAlternatives ?? MAX_AUTOMATIC_ROUTE_ALTERNATIVES, 4));
  const excludedOrders = [initial.order];
  const evaluatedCandidates: Array<{ candidate: TCandidate; order: number[]; audit: TAudit }> = [];
  let candidate = initial.value;
  let currentOrder = [...initial.order];
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
    evaluatedCandidates.push({ candidate, order: currentOrder, audit });
    if (!options.requiresReplan(audit)) {
      return { status: "accepted", candidate, audit, auditAttempts, alternativeAttempts };
    }
    if (alternativeAttempts >= maxAlternatives) {
      const fallback = options.selectViableFallback?.(evaluatedCandidates);
      if (fallback) {
        return { status: "accepted", candidate: fallback.candidate, audit: fallback.audit, auditAttempts, alternativeAttempts, viableFallback: true };
      }
      return { status: "alternatives_exhausted", candidate, audit, auditAttempts, alternativeAttempts };
    }

    alternativeAttempts += 1;
    options.onAlternativeSearch?.(alternativeAttempts);
    try {
      const alternative = await options.findAlternative(excludedOrders.map((order) => [...order]), candidate, audit);
      if (!alternative) {
        const fallback = options.selectViableFallback?.(evaluatedCandidates);
        if (fallback) {
          return { status: "accepted", candidate: fallback.candidate, audit: fallback.audit, auditAttempts, alternativeAttempts, viableFallback: true };
        }
        return { status: "alternatives_exhausted", candidate, audit, auditAttempts, alternativeAttempts };
      }
      if (evaluatedCandidates.some((evaluated) => (options.isDuplicateCandidate ?? ((left, right) => left.order.join(",") === right.order.join(",")))(
        { value: evaluated.candidate, order: evaluated.order }, alternative
      ))) {
        const fallback = options.selectViableFallback?.(evaluatedCandidates);
        if (fallback) {
          return { status: "accepted", candidate: fallback.candidate, audit: fallback.audit, auditAttempts, alternativeAttempts, viableFallback: true };
        }
        return { status: "alternatives_exhausted", candidate, audit, auditAttempts, alternativeAttempts };
      }
      if (!excludedOrders.some((order) => order.join(",") === alternative.order.join(","))) excludedOrders.push(alternative.order);
      candidate = alternative.value;
      currentOrder = [...alternative.order];
    } catch (reason) {
      const message = options.getErrorMessage?.(reason);
      if (message?.includes("route_alternative_exhausted")) {
        const fallback = options.selectViableFallback?.(evaluatedCandidates);
        if (fallback) {
          return { status: "accepted", candidate: fallback.candidate, audit: fallback.audit, auditAttempts, alternativeAttempts, viableFallback: true };
        }
        return { status: "alternatives_exhausted", candidate, audit, auditAttempts, alternativeAttempts };
      }
      const fallback = options.selectViableFallback?.(evaluatedCandidates);
      if (fallback) {
        return { status: "accepted", candidate: fallback.candidate, audit: fallback.audit, auditAttempts, alternativeAttempts, error: message, viableFallback: true };
      }
      return {
        status: "alternative_error", candidate, audit, auditAttempts, alternativeAttempts,
        error: message
      };
    }
  }
}
