import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260916130000_optimize_roster_and_incentive_selection_latency.sql",
  "utf8"
);
const hotPathMigration = readFileSync(
  "supabase/migrations/20260916131500_finish_roster_selection_hot_path.sql",
  "utf8"
);
const shortCircuitMigration = readFileSync(
  "supabase/migrations/20260916133000_short_circuit_roster_summary_search.sql",
  "utf8"
);
const rosterApi = readFileSync("src/modules/roster/services/rosterApi.ts", "utf8");
const rosterQueries = readFileSync("src/modules/roster/hooks/useRosterQueries.ts", "utf8");
const rosterPage = readFileSync("src/modules/roster/pages/RosterPage.tsx", "utf8");
const rosterLookup = readFileSync(
  "src/modules/roster/components/RosterWorkerLookup.tsx",
  "utf8"
);
const incentiveQueries = readFileSync(
  "src/modules/incentives/hooks/useIncentivesQueries.ts",
  "utf8"
);
const incentiveLookup = readFileSync(
  "src/modules/incentives/components/IncentiveWorkerLookup.tsx",
  "utf8"
);

describe("roster and incentive selection performance", () => {
  it("persists the deterministic BUK exit projection instead of parsing JSON per request", () => {
    expect(migration).toContain("buk_exit_date date");
    expect(migration).toContain("generated always as");
    expect(migration).toContain("idx_employees_inactive_buk_exit_date");
    expect(migration).toContain("e.buk_exit_date >= range_start");
    expect(migration).toContain("e.buk_exit_date >= month_start");
    expect(migration).not.toContain(
      "public.extract_buk_employee_exit_date(e.raw_payload) >= range_start"
    );
  });

  it("serves roster lookup from the synchronized private worker cache", () => {
    expect(hotPathMigration).toContain("from private.hr_incentive_worker_search_cache cache");
    expect(hotPathMigration).toContain("cache.search_text like '%' || normalized_search || '%'");
    expect(hotPathMigration).toContain("cache.is_private_role = false");
    expect(hotPathMigration).toContain("document_type = excluded.document_type");
    expect(hotPathMigration).toContain("contract_code = excluded.contract_code");
    expect(hotPathMigration).toContain(
      "revoke all on function public.search_hr_roster_workers(text, integer) from public, anon, authenticated"
    );
  });

  it("computes roster summary once per scoped worker without eager search projection", () => {
    expect(hotPathMigration).toContain("with filtered_workers as materialized");
    expect(hotPathMigration).toContain("worker_states as materialized");
    expect(hotPathMigration).toContain("exists (");
    expect(hotPathMigration).toContain("count(*) filter (where ws.is_assigned)");
    expect(hotPathMigration).toContain("normalized_search = ''\n          or public.build_active_employee_search_text");
    expect(shortCircuitMigration).toContain("when normalized_search = '' then true");
    expect(shortCircuitMigration).toContain("when normalized_contract = '' then true");
    expect(shortCircuitMigration).toContain("when normalized_area = '' then true");
  });

  it("cancels superseded roster requests and reuses normalized worker searches", () => {
    expect(rosterApi).toContain("request.abortSignal(signal)");
    expect(rosterQueries).toContain("queryFn: ({ signal }) => searchRosterWorkers");
    expect(rosterQueries).toContain("queryFn: ({ signal }) =>\n      fetchRosterCalendarSummary");
    expect(rosterQueries).toContain("5 * 60_000");
    expect(incentiveQueries).toContain(
      "queryKeys.incentives.workerSearch(normalizedSearch)"
    );
    expect(incentiveQueries).toContain("refetchOnWindowFocus: false");
    expect(rosterLookup).toContain("debounceMs={150}");
    expect(incentiveLookup).toContain("debounceMs={150}");
  });

  it("derives scoped KPI counts from the already loaded calendar payload", () => {
    expect(rosterPage).toContain("enabled: !isPatternsView && !hasRosterScopeFilter");
    expect(rosterPage).toContain("const scopedRosterSummary = useMemo");
    expect(rosterPage).toContain("worker.days.some((day) => Boolean(day.assignmentId))");
  });
});
