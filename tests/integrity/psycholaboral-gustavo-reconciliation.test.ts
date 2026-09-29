import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read(
  "supabase/migrations/20260929133000_reconcile_gustavo_cortes_psycholaboral.sql",
);
const eligibility = read(
  "supabase/migrations/20260924120000_allow_psycholaboral_for_contingency_hires.sql",
);

describe("Gustavo Cortes Psycholaboral reconciliation", () => {
  it("requires the exact active BUK identity and refuses duplicate ERP profiles", () => {
    expect(migration).toContain("e.buk_employee_id = '43950'");
    expect(migration).toContain("e.is_active");
    expect(migration).toContain("'156120510'");
    expect(migration).toContain("ya tiene un candidato ERP");
    expect(migration).toContain("candidate_hired");
  });

  it("links the external BUK evidence to the new hired candidate", () => {
    expect(migration).toContain("recruitment_case_candidate_id = v_candidate_id");
    expect(migration).toContain("is_active = true");
    expect(migration).toContain("external_buk_hire_reconciled");
    expect(eligibility).toContain("public.recruitment_case_external_hires");
    expect(eligibility).toContain("employee_buk_employee_id");
  });
});
