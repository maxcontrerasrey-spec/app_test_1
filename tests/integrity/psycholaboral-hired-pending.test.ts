import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read(
  "supabase/migrations/20260929143000_show_hired_psycholaboral_without_assessment.sql",
);
const filledCaseMigration = read(
  "supabase/migrations/20260929144000_include_verified_hires_in_psycholaboral.sql",
);

describe("Psycholaboral hired pending visibility", () => {
  it("classifies every hired candidate as Contratado, including those without an assessment", () => {
    expect(migration).toContain("previous_fragment constant text := 'when stage_code=''hired'' and assessment_id is not null then ''hired'''");
    expect(migration).toContain("next_fragment constant text := 'when stage_code=''hired'' then ''hired'''");
    expect(migration).toContain("get_psycholaboral_candidates_page");
    expect(migration).toContain("get_psycholaboral_status_summary");
  });

  it("keeps the authenticated RPC contract explicit", () => {
    expect(migration).toContain("grant execute on function public.get_psycholaboral_candidates_page(text, text, integer, integer) to authenticated");
    expect(migration).toContain("grant execute on function public.get_psycholaboral_status_summary(text) to authenticated");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("keeps verified hired candidates visible after their case is filled", () => {
    expect(filledCaseMigration).toContain("rcc.stage_code=''hired''");
    expect(filledCaseMigration).toContain("public.psycholaboral_candidate_has_eligible_process(rcc.id)");
    expect(filledCaseMigration).toContain("or a.id is not null");
  });
});
