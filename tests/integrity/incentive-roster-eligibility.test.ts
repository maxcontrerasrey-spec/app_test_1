import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260904134428_block_hr_incentives_without_roster.sql",
  "utf8"
);

describe("incentive roster eligibility contract", () => {
  it("blocks creation when the worker has no ERP roster assignment", () => {
    expect(migration).toContain("assert_hr_incentive_roster_assignment");
    expect(migration).toContain("roster_day_row.assignment_id is null");
    expect(migration).toContain("No se puede registrar ni pagar un incentivo extraordinario");
  });

  it("revalidates the roster before an incentive reaches final status", () => {
    expect(migration).toContain("before insert or update of status");
    expect(migration).toContain("new.status = 'F' and old.status is distinct from 'F'");
    expect(migration).toContain("trg_block_hr_incentive_without_roster");
  });
});
