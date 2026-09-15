import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260915122747_optimize_hr_incentive_security_and_capacity.sql",
  "utf8"
);
const analyticsMigration = readFileSync(
  "supabase/migrations/20260915143000_bound_hr_incentive_analytics_payload.sql",
  "utf8"
);

describe("incentives security and operational capacity", () => {
  it("keeps the worker search cache private and synchronized from employees", () => {
    expect(migration).toContain("private.hr_incentive_worker_search_cache");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "revoke all on table private.hr_incentive_worker_search_cache from public, anon, authenticated"
    );
    expect(migration).toContain("trg_sync_hr_incentive_worker_search_cache");
    expect(migration).toContain("using gin (search_text gin_trgm_ops)");
  });

  it("serves incentive worker searches from precomputed values", () => {
    expect(migration).toContain("from private.hr_incentive_worker_search_cache cache");
    expect(migration).toContain("cache.search_text like '%' || normalized_search || '%'");
    expect(migration).not.toContain(
      "public.build_active_employee_search_text(\n          e.full_name"
    );
  });

  it("isolates stale rows in bulk approvals and caps transaction size", () => {
    expect(migration).toContain("expected_approval_count > 100");
    expect(migration).toContain("foreach current_approval_id in array normalized_approval_ids");
    expect(migration).toContain("exception\n      when others then");
    expect(migration).toContain("success := false");
    expect(migration).toContain("public.hr_incentive_decide_approval_impl(");
    expect(migration).toContain("for update skip locked");
  });

  it("scopes approval reads and makes same-actor retries idempotent", () => {
    expect(migration).toContain("can_view_all := public.user_is_admin(current_user_id)");
    expect(migration).toContain("hira.approver_user_id = current_user_id");
    expect(migration).toContain(
      "public.user_can_access_feature(current_user_id, 'hr_incentives_history')"
    );
    expect(migration).toContain("existing_approval.decision_by = current_user_id");
  });

  it("does not expose salary inputs through worker context", () => {
    expect(migration).toContain(
      "(payload -> 'worker') - 'base_salary' - 'weekly_hours'"
    );
  });

  it("removes direct authenticated access to the roster reconciliation mutator", () => {
    expect(migration).toContain(
      "revoke all on function public.reconcile_hr_roster_extra_shift_from_incentives("
    );
    expect(migration).toContain(") from public, anon, authenticated;");
  });
});

describe("incentives analytics capacity", () => {
  it("aggregates the daily trend in PostgreSQL and keeps the base function private", () => {
    expect(analyticsMigration).toContain("'total_amount_by_date'");
    expect(analyticsMigration).toContain("group by request.service_date");
    expect(analyticsMigration).toMatch(
      /revoke all on function public\.get_hr_incentives_analytics_base_20260915[\s\S]*from public, anon, authenticated/i
    );
  });
});
