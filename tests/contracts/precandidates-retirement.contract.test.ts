import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { onRequest as retiredApplicationLink } from "../../functions/postulacion-dsal";
import { onRequest as retiredWorkerFileLink } from "../../functions/ficha-buk-dsal";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("retirement of the public DSAL intake", () => {
  it("returns Gone for both previously public links without caching the response", async () => {
    for (const handler of [retiredApplicationLink, retiredWorkerFileLink]) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toContain("ya no está disponible");
    }
  });

  it("removes the retired routes, lazy imports, review UI, and client query surface", () => {
    const router = read("src/app/router/AppRouter.tsx");
    const routeModules = read("src/app/router/routeModules.ts");
    const recruitmentPage = read("src/modules/recruitment/pages/HiringStatusPage.tsx");
    const queries = read("src/modules/recruitment/hooks/useRecruitmentQueries.ts");
    const queryKeys = read("src/shared/lib/queryKeys.ts");

    for (const source of [router, routeModules, recruitmentPage, queries, queryKeys]) {
      expect(source).not.toMatch(/precandidate|precandidato|postulacion-dsal|ficha-buk-dsal/i);
    }

    expect(router).toContain('path="/evaluacionpsico"');
    expect(router).toContain('path="/verificar/documento"');
  });

  it("drops only retired storage and RPCs, with an in-migration guard for promoted candidates", () => {
    const migrationPath = read("supabase/migrations/20261006201516_retire_dsal_precandidates.sql");
    const migration = migrationPath.toLowerCase();

    for (const objectName of [
      "recruitment_public_buk_form_sessions",
      "recruitment_precandidates",
      "recruitment_dsal_judicial_causes",
      "recruitment_dsal_judicial_summary",
      "recruitment_dsal_roster",
      "submit_dsal_precandidate_application",
      "get_recruitment_precandidates_page",
      "approve_recruitment_precandidate",
      "reject_recruitment_precandidate",
      "get_dsal_roster_identity",
      "start_public_dsal_buk_worker_file",
      "submit_public_dsal_buk_worker_file"
    ]) {
      expect(migration).toContain(objectName);
    }

    expect(migration).toContain("status = 'approved'");
    expect(migration).toContain("left join public.recruitment_cases approved_case");
    expect(migration).toContain("left join public.recruitment_case_candidates approved_candidate");
    expect(migration).toContain("regexp_replace(lower(candidate_profile.national_id)");
    expect(migration).toContain("candidate_profile.id is null");
    expect(migration).not.toContain("approved_candidate.recruitment_case_id = rp.approved_recruitment_case_id");
    expect(migration).toContain("raise exception");
    expect(migration).not.toMatch(/drop\s+table[^;]*cascade/i);
    expect(migration).not.toMatch(/drop\s+table[^;]*candidate_profiles/i);
    expect(migration).not.toMatch(/drop\s+table[^;]*recruitment_case_candidates/i);
    expect(migration).not.toMatch(/drop\s+table[^;]*candidate_documents/i);
  });
});
