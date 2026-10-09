import { describe, expect, it, vi } from "vitest";
import { searchAuditedRoute } from "../../src/modules/operaciones/lib/auditedRouteSearch";

type Candidate = { route: string; order: number[] };
type Audit = { runId: string | null; requiresReplan: boolean; suggestsAlternative?: boolean; status: "OK" | "ERROR"; routeDurationSeconds?: number };
const initial: Candidate = { route: "initial", order: [0, 1, 2] };
const persisted = (requiresReplan: boolean): Audit => ({ runId: crypto.randomUUID(), requiresReplan, status: "OK" });
const config = (overrides: Partial<Parameters<typeof searchAuditedRoute<Candidate, Audit>>[1]> = {}) => ({
  audit: vi.fn(async () => persisted(false)),
  shouldExploreAlternative: (audit: Audit) => audit.suggestsAlternative ?? audit.requiresReplan,
  hasPersistedEvaluation: (audit: Audit) => audit.status === "OK" && Boolean(audit.runId),
  findAlternative: vi.fn(async () => null),
  getErrorMessage: (reason: unknown) => reason instanceof Error ? reason.message : String(reason),
  ...overrides
});

describe("bounded AI-audited route search", () => {
  it("accepts the initial route after auditing it once", async () => {
    const options = config();
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);
    expect(result.status).toBe("accepted");
    expect(result.auditAttempts).toBe(1);
    expect(options.findAlternative).not.toHaveBeenCalled();
  });

  it("explores an AI improvement below 50 minutes while preserving the fastest audited viable route", async () => {
    const alternative = { route: "faster alternative", order: [0, 2, 1] };
    const options = config({
      audit: vi.fn(async (candidate: Candidate) => ({
        ...persisted(false), suggestsAlternative: true,
        routeDurationSeconds: candidate.route === "initial" ? 2_800 : 2_600
      })),
      selectViableFallback: (evaluated) => {
        const best = evaluated.filter(({ audit }) => (audit.routeDurationSeconds ?? Infinity) < 3_000)
          .sort((left, right) => (left.audit.routeDurationSeconds ?? Infinity) - (right.audit.routeDurationSeconds ?? Infinity))[0];
        return best ? { candidate: best.candidate, audit: best.audit } : null;
      },
      findAlternative: vi.fn(async () => ({ value: alternative, order: alternative.order }))
    });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);

    expect(options.findAlternative).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "accepted", candidate: alternative, viableFallback: true, alternativeAttempts: 2 });
    expect(result.audit?.routeDurationSeconds).toBe(2_600);
  });

  it("falls back to an audited under-50-minute route when an optional AI audit errors", async () => {
    const alternative = { route: "unverified alternative", order: [0, 2, 1] };
    const options = config({
      audit: vi.fn(async (candidate: Candidate) => {
        if (candidate.route !== "initial") throw new Error("AI timeout");
        return { ...persisted(false), suggestsAlternative: true, routeDurationSeconds: 2_700 };
      }),
      selectViableFallback: (evaluated) => {
        const best = evaluated.find(({ audit }) => (audit.routeDurationSeconds ?? Infinity) < 3_000);
        return best ? { candidate: best.candidate, audit: best.audit } : null;
      },
      findAlternative: vi.fn(async () => ({ value: alternative, order: alternative.order }))
    });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);

    expect(result).toMatchObject({ status: "accepted", candidate: initial, error: "AI timeout", viableFallback: true });
    expect(result.audit?.routeDurationSeconds).toBe(2_700);
  });

  it("automatically audits each distinct alternative and preserves rejected orders", async () => {
    const first = { route: "first alternative", order: [0, 2, 1] };
    const second = { route: "second alternative", order: [1, 0, 2] };
    const options = config({
      audit: vi.fn(async (candidate: Candidate) => persisted(candidate.route === "initial" || candidate.route === "first alternative")),
      findAlternative: vi.fn(async (excluded: number[][]) => {
        const candidate = excluded.length === 1 ? first : second;
        return { value: candidate, order: candidate.order };
      })
    });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);
    expect(result.status).toBe("accepted");
    expect(result.candidate).toBe(second);
    expect(result.auditAttempts).toBe(3);
    expect(result.alternativeAttempts).toBe(2);
    expect(options.findAlternative.mock.calls.map(([orders]) => orders)).toEqual([
      [[0, 1, 2]], [[0, 1, 2], [0, 2, 1]]
    ]);
  });

  it("stops after the configured alternative budget while keeping the last route blocked", async () => {
    const alternative = { route: "alternative", order: [1, 0, 2] };
    const secondAlternative = { route: "second alternative", order: [2, 0, 1] };
    const options = config({
      audit: vi.fn(async () => persisted(true)),
      findAlternative: vi.fn(async (excluded: number[][]) => {
        const candidate = excluded.length === 1 ? alternative : secondAlternative;
        return { value: candidate, order: candidate.order };
      })
    });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);
    expect(result.status).toBe("alternatives_exhausted");
    expect(result.candidate).toBe(secondAlternative);
    expect(result.auditAttempts).toBe(3);
    expect(result.alternativeAttempts).toBe(2);
  });

  it("keeps the fastest under-50-minute audited route after trying slower alternatives", async () => {
    const options = config({
      audit: vi.fn(async (candidate: Candidate) => ({ ...persisted(true), routeDurationSeconds: candidate.route === "initial" ? 2_990 : candidate.route === "fast alternative" ? 2_950 : 3_100 })),
      selectViableFallback: (evaluated) => {
        const pick = evaluated.filter(({ audit }) => (audit.routeDurationSeconds ?? Infinity) < 3_000)
          .sort((left, right) => (left.audit.routeDurationSeconds ?? Infinity) - (right.audit.routeDurationSeconds ?? Infinity))[0];
        return pick ? { candidate: pick.candidate, audit: pick.audit } : null;
      },
      findAlternative: vi.fn(async (excluded: number[][]) => excluded.length === 1
        ? { value: { route: "fast alternative", order: [0, 2, 1] }, order: [0, 2, 1] }
        : { value: { route: "slow alternative", order: [1, 0, 2] }, order: [1, 0, 2] })
    });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);

    expect(result).toMatchObject({ status: "accepted", candidate: { route: "fast alternative" }, auditAttempts: 3, alternativeAttempts: 2, viableFallback: true });
    expect(result.audit?.routeDurationSeconds).toBe(2_950);
    expect(options.findAlternative).toHaveBeenCalledTimes(2);
  });

  it("does not use the viability fallback for routes outside the under-50-minute rule", async () => {
    const options = config({
      audit: vi.fn(async () => persisted(true)),
      selectViableFallback: () => null,
      findAlternative: vi.fn(async () => null)
    });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);

    expect(result.status).toBe("alternatives_exhausted");
  });

  it("does not search alternatives when persistence or AI evaluation failed", async () => {
    const options = config({ audit: vi.fn(async () => ({ runId: null, requiresReplan: true, status: "ERROR" as const })) });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);
    expect(result.status).toBe("audit_error");
    expect(options.findAlternative).not.toHaveBeenCalled();
  });

  it("stops on an AI transport error and keeps the exact candidate for retry", async () => {
    const options = config({ audit: vi.fn(async () => { throw new Error("timeout"); }) });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);
    expect(result.status).toBe("audit_error");
    expect(result.candidate).toBe(initial);
    expect(result.error).toBe("timeout");
    expect(options.findAlternative).not.toHaveBeenCalled();
  });

  it("stops on a stale evaluation instead of applying a late candidate", async () => {
    const options = config({ audit: vi.fn(async () => null) });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);
    expect(result.status).toBe("stale");
    expect(result.candidate).toBe(initial);
    expect(options.findAlternative).not.toHaveBeenCalled();
  });

  it("rejects a duplicate order from the optimizer", async () => {
    const options = config({
      audit: vi.fn(async () => persisted(true)),
      findAlternative: vi.fn(async () => ({ value: initial, order: initial.order }))
    });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);
    expect(result.status).toBe("alternatives_exhausted");
  });

  it("allows a distinct traced geometry for the same stop order", async () => {
    const sameOrderAlternate = { route: "rerouted geometry", order: [0, 1, 2] };
    const options = config({
      audit: vi.fn(async (candidate: Candidate) => persisted(candidate.route === "initial")),
      findAlternative: vi.fn(async () => ({ value: sameOrderAlternate, order: sameOrderAlternate.order })),
      isDuplicateCandidate: (left, right) => left.order.join(",") === right.order.join(",") && left.value.route === right.value.route
    });
    const result = await searchAuditedRoute({ value: initial, order: initial.order }, options);

    expect(result.status).toBe("accepted");
    expect(result.candidate).toBe(sameOrderAlternate);
    expect(result.auditAttempts).toBe(2);
  });
});
