import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260916012845_make_buk_roster_sync_authoritative.sql",
  "utf8"
);
const syncScript = readFileSync("scripts/sync-buk-employees.mjs", "utf8");
const rosterPage = readFileSync("src/modules/roster/pages/RosterPage.tsx", "utf8");

describe("authoritative BUK to roster synchronization", () => {
  it("finalizes only a complete BUK snapshot and deactivates workers absent from it", () => {
    expect(syncScript).toContain('supabase.rpc("start_buk_employee_sync"');
    expect(syncScript).toContain('supabase.rpc("finalize_buk_employee_sync"');
    expect(syncScript).toContain('supabase.rpc("fail_buk_employee_sync"');
    expect(syncScript).toContain("rawFetched !== synced || synced !== seenEmployeeIds.size");
    expect(syncScript).toContain('table: "buk_employee_sync_staging"');
    expect(syncScript).toContain("sync_run_id: syncRunId");
    expect(migration).toContain("public.buk_employee_sync_staging");
    expect(migration).toContain("from public.buk_employee_sync_staging s");
    expect(migration).toContain("seen_workers <> p_expected_count");
    expect(migration).toContain("e.last_seen_buk_sync_id is distinct from p_sync_run_id");
    expect(migration).toContain("status = 'missing_from_buk'");
  });

  it("preserves roster history while invalidating current and future use after a BUK change", () => {
    expect(migration).toContain("trg_employees_reconcile_hr_roster");
    expect(migration).toContain("invalidated_effective_date");
    expect(migration).toContain("hr_roster_assignment_applies_on_buk_date");
    expect(migration).toContain("p_target_date < p_invalidated_effective_date");
    expect(migration).not.toContain("delete from public.hr_worker_rosters");
  });

  it("uses the same BUK-aware resolver for roster and incentive calculations", () => {
    expect(migration).toContain("create or replace function public.resolve_hr_roster_day_status");
    expect(migration).toContain("employee_row.contract_code");
    expect(migration).toContain("employee_row.area_name");
    expect(migration).toContain("create or replace function public.get_hr_roster_bulk_calendar");
    expect(migration).toContain("create or replace function public.get_worker_schedule");
  });

  it("keeps synchronization RPCs service-role only and refreshes an open roster after completion", () => {
    expect(migration).toContain(
      "revoke all on function public.finalize_buk_employee_sync(uuid, integer, jsonb) from public, anon, authenticated"
    );
    expect(migration).toContain(
      "grant execute on function public.finalize_buk_employee_sync(uuid, integer, jsonb) to service_role"
    );
    expect(migration).toContain("alter table public.buk_employee_sync_runs enable row level security");
    expect(rosterPage).toContain('{ table: "buk_employee_sync_runs", event: "UPDATE" }');
  });
});
