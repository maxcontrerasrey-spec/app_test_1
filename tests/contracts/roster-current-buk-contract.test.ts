import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260915173000_align_roster_assignment_with_current_buk_contract.sql",
  "utf8"
);

describe("roster assignment current BUK contract", () => {
  it("requires both contract and area compatibility", () => {
    expect(migration).toContain("hr_roster_assignment_matches_current_buk");
    expect(migration).toContain("wr.contract_code, wr.area_name, fw.contract_code, fw.area_name");
  });

  it("keeps the historical roster rows and applies compatibility to calendar and KPI", () => {
    expect(migration).toContain("from public.hr_worker_rosters wr join public.hr_shift_patterns hp");
    expect(migration).toContain("join public.hr_worker_rosters wr");
    expect(migration).not.toContain("delete from public.hr_worker_rosters");
  });
});
