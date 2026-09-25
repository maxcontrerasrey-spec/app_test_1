import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260925123000_optimize_candidate_checklist_code_resolution.sql",
);

describe("candidate checklist performance guard", () => {
  it("removes the live BUK registry scan from checklist reads", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("get_candidate_checklist(uuid)");
    expect(migration).toContain("public.resolve_candidate_worker_employee_code(candidate_rec.id)");
    expect(migration).toContain(
      "effective_employee_code := nullif(trim(coalesce(worker_rec.employee_code, '')), '');",
    );
    expect(migration).toContain(
      "No se encontró la resolución BUK costosa esperada en get_candidate_checklist(uuid)",
    );
    expect(migration).toContain("grant execute on function public.get_candidate_checklist(uuid) to authenticated;");
  });
});
