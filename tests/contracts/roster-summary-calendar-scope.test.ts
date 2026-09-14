import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260914160000_align_roster_summary_with_bulk_calendar_scope.sql",
  "utf8"
);

describe("roster summary and bulk calendar scope contract", () => {
  it("includes workers with a BUK exit inside the visible month", () => {
    expect(migration).toContain("e.is_active = true");
    expect(migration).toContain("extract_buk_employee_exit_date(e.raw_payload) >= month_start");
  });

  it("deduplicates the same worker key used by the bulk calendar", () => {
    expect(migration).toContain("select distinct on (e.buk_employee_id)");
    expect(migration).toContain("order by\n        e.buk_employee_id");
  });

  it("preserves the authenticated RPC contract and filters", () => {
    expect(migration).toContain("p_search text default null");
    expect(migration).toContain("p_contract_filter text default null");
    expect(migration).toContain("p_area_filter text default null");
    expect(migration).toContain("grant execute on function public.get_hr_roster_calendar_summary(date, text, text, text) to authenticated");
  });
});
