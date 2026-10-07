import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261007153000_roster_calendar_pagination_v2.sql",
  "utf8"
);
const api = readFileSync("src/modules/roster/services/rosterApi.ts", "utf8");
const hooks = readFileSync("src/modules/roster/hooks/useRosterQueries.ts", "utf8");
const browseHook = readFileSync("src/modules/roster/hooks/useRosterCalendarBrowse.ts", "utf8");
const page = readFileSync("src/modules/roster/pages/RosterPage.tsx", "utf8");
const loadHarness = readFileSync("performance/k6/worker-search.js", "utf8");

describe("paged HR roster calendar contract", () => {
  it("limits the selected and stably ordered worker population before expanding dates", () => {
    const pageLimit = migration.indexOf("limit page_limit", migration.indexOf("page_workers as materialized"));
    const dayExpansion = migration.indexOf("cross join lateral generate_series", migration.indexOf("worker_days as"));

    expect(pageLimit).toBeGreaterThan(-1);
    expect(dayExpansion).toBeGreaterThan(pageLimit);
    expect(migration).toContain("order by filtered.full_name, filtered.buk_employee_id");
    expect(migration).toContain("(filtered.full_name, filtered.buk_employee_id) > (p_after_full_name, p_after_buk_employee_id)");
    expect(migration).not.toContain("offset page_offset");
    expect(migration).toContain("page_limit := least(greatest(coalesce(p_page_size, 50), 1), 50)");
  });

  it("derives global cycle facets from effective assignment intervals, not a worker-day JSON grid", () => {
    expect(migration).toContain("interval_boundaries as (");
    expect(migration).toContain("lead(boundary_date) over (partition by buk_employee_id order by boundary_date)");
    expect(migration).toContain("assignment_start_date desc, a.assignment_created_at desc");
    expect(migration).toContain("regexp_match(rs.pattern_name, '([0-9]+\\s*[xX]\\s*[0-9]+(\\s*\\+\\s*[0-9]+)?)')");
    expect(migration).toContain("matches.cycle_match[1]");
    expect(migration).toContain("'__no_pattern__'::text");
    expect(migration).toContain("count(distinct wc.buk_employee_id)");
  });

  it("keeps cycle paging aligned with global facets when a worker changes cycle in range", () => {
    const cycleFilterStart = migration.indexOf(
      "), filtered_workers as materialized (",
      migration.indexOf("create or replace function public.get_hr_roster_bulk_calendar_page_v2")
    );
    const cycleFilterEnd = migration.indexOf("), page_workers as materialized", cycleFilterStart);
    const cycleFilter = migration.slice(cycleFilterStart, cycleFilterEnd);

    expect(cycleFilter).toContain("not exists (");
    expect(cycleFilter).toContain("and assigned.cycle_label is not null");
    expect(cycleFilter).toContain("and assigned.cycle_label = normalized_cycle_filter");
    expect(cycleFilter).not.toContain("wc.cycle_label = normalized_cycle_filter");
  });

  it("keeps the public wrappers authenticated and the shared helper inaccessible to API roles", () => {
    expect(migration).toContain("public.user_can_view_hr_roster(current_user_id)");
    expect(migration).toContain("from public, anon, authenticated, service_role");
    expect(migration).toContain(
      "grant execute on function public.get_hr_roster_calendar_scope_summary_v2(date, date, text, text, text, text)\n  to authenticated"
    );
    expect(migration).toContain(
      "grant execute on function public.get_hr_roster_bulk_calendar_page_v2(date, date, text, text, text, text, text, integer, integer, text, text)\n  to authenticated"
    );
    expect(migration).toContain("private.get_hr_roster_worker_cycle_scope_v2");
  });

  it("preserves the production exit-date population and rejects partial cursors", () => {
    expect(migration).toContain(
      "e.is_active = true and (e.buk_exit_date is null or e.buk_exit_date >= p_start_date)"
    );
    expect(migration).toContain("(p_after_full_name is null) <> (p_after_buk_employee_id is null)");
    expect(migration).toContain("El cursor de jornadas está incompleto");
  });

  it("propagates React Query cancellation and keys all page/filter dimensions", () => {
    expect(api).toContain('client.rpc("get_hr_roster_bulk_calendar_page_v2"');
    expect(api).toContain('client.rpc("get_hr_roster_calendar_scope_summary_v2"');
    expect(api).toContain("request.abortSignal(signal)");
    expect(hooks).toContain("cycleFilter");
    expect(hooks).toContain("pageSize");
    expect(hooks).toContain("queryKeys.roster.calendarScopeSummary");
    expect(browseHook).toContain("setTimeout(() => setCalendarSearchTerm(workerSearchTerm.trim()), 250)");
    expect(page).toContain("onLoadAllWorkersForExport={loadAllRosterWorkersForExport}");
    expect(page).toContain("fetchAllRosterBulkCalendarPages({");
    expect(api).toContain("const pageSize = 50");
    expect(api).toContain("while (nextPage.hasMore && nextPage.nextCursor)");
    expect(browseHook).toContain("cursor: currentCursor");
  });

  it("retains range caps and refuses unscoped high-cardinality calendar reads", () => {
    expect(migration.match(/range_end - range_start > 184/g)).toHaveLength(2);
    expect(migration.match(/range_end > projection_horizon_end/g)).toHaveLength(2);
    expect(migration.match(/normalized_area = '' and normalized_contract_admin = ''/g)).toHaveLength(2);
    expect(migration).toContain("requested_page > 10000");
  });

  it("requires staging, synthetic data, and one manually confirmed load tier", () => {
    expect(loadHarness).toContain('PERFORMANCE_TARGET_ENV !== "staging"');
    expect(loadHarness).toContain('projectRef === productionProjectRef');
    expect(loadHarness).toContain("requestedVus !== confirmedVus");
    expect(loadHarness).toContain('executor: "constant-vus"');
    expect(loadHarness).toContain('"roster_calendar_duration{range_days:31}": ["p(95)<2000"]');
    expect(loadHarness).toContain("get_hr_roster_bulk_calendar_page_v2");
  });
});
