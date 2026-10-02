import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read(
  "supabase/migrations/20261002124040_preserve_terminal_candidate_on_psycholaboral_rejection.sql",
);
const page = read("src/modules/psycholaboral/pages/PsycholaboralManagementPage.tsx");
const styles = read("src/modules/psycholaboral/styles/psycholaboral.css");
const types = read("src/modules/psycholaboral/types.ts");

describe("Psycholaboral decisions for terminal candidates", () => {
  it("preserves terminal recruitment state and reasons while recording the assessment decision", () => {
    expect(migration).toContain("candidate_stage in ('hired', 'rejected', 'withdrawn')");
    expect(migration).toContain("-- Preserve recruitment stage/reasons and do not enqueue document cleanup.");
    expect(migration).toContain("'candidate_stage_preserved'");
    expect(migration).toContain("'candidate_stage_before', candidate_stage");
    expect(migration).toContain("public.user_can_manage_recruitment_case(uid, candidate_case_id)");
    expect(migration).toContain("public.advance_recruitment_candidate_stage(");
  });

  it("keeps RPC access restricted to authenticated users and separates rejected assessments", () => {
    expect(migration).toContain("revoke all on function public.decide_psycholaboral_assessment(uuid, text, text) from public, anon");
    expect(migration).toContain("grant execute on function public.decide_psycholaboral_assessment(uuid, text, text) to authenticated");
    expect(migration).toContain("when decision='rejected' then 'rejected'");
    expect(migration).toContain("when a.decision='rejected' then 'rejected'");
    expect(types).toContain('"rejected" | "hired"');
  });

  it("explains that a terminal process and its documents will not change", () => {
    expect(page).toContain("const terminalCandidate = [\"hired\", \"rejected\", \"withdrawn\"]");
    expect(page).toContain("El estado y los documentos del proceso se mantendrán sin cambios.");
    expect(page).toContain('{ key: "rejected", label: "Rechazo psicolaboral" }');
    expect(styles).toContain(".psych-status--rejected");
  });
});
