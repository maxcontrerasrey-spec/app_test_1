import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read(
  "supabase/migrations/20260821180000_allow_sin_folio_candidate_detail.sql"
);
const service = read("src/modules/recruitment/services/hiringControl.ts");
const queries = read("src/modules/recruitment/hooks/useRecruitmentQueries.ts");
const page = read("src/modules/recruitment/pages/HiringStatusPage.tsx");

describe("Sin Folio candidate detail contract", () => {
  it("keeps released candidates out of the operational case detail but allows the selected ficha", () => {
    expect(migration).toContain("get_recruitment_case_detail_for_candidate");
    expect(migration).toContain(
      "rcc.released_without_folio_at is null or rcc.id = p_case_candidate_id"
    );
    expect(migration).toContain(
      "grant execute on function public.get_recruitment_case_detail_for_candidate(uuid, uuid) to authenticated"
    );
  });

  it("passes the selected candidate through the detail query and cache key", () => {
    expect(service).toContain('supabase.rpc("get_recruitment_case_detail_for_candidate"');
    expect(queries).toContain("candidateId?: string");
    expect(queries).toContain("candidateId ?? \"case\"");
    expect(page).toContain("selectedCandidateId || undefined");
  });
});
