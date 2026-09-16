import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260916012845_make_buk_roster_sync_authoritative.sql",
  "utf8"
);

describe("roster assignment current BUK contract", () => {
  it("requires both contract and area compatibility", () => {
    expect(migration).toContain("hr_roster_assignment_matches_current_buk");
    expect(migration).toContain("normalize_buk_contract_code");
    expect(migration).toContain("normalize_buk_area_name");
  });

  it("keeps the historical roster rows and applies compatibility to calendar and KPI", () => {
    expect(migration).toContain("hr_roster_assignment_applies_on_buk_date");
    expect(migration).toContain("invalidated_effective_date");
    expect(migration).not.toContain("delete from public.hr_worker_rosters");
  });
});
