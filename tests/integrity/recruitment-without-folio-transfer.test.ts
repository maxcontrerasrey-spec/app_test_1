import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read(
  "supabase/migrations/20260821170000_release_single_candidate_without_folio.sql"
);
const service = read("src/modules/recruitment/services/hiringControl.ts");
const modal = read("src/modules/recruitment/components/TransferCandidateModal.tsx");

describe("individual Sin Folio release contract", () => {
  it("keeps the release backend-authoritative, authorized and idempotent", () => {
    expect(migration).toContain("create or replace function public.release_candidate_without_folio");
    expect(migration).toContain("perform public.assert_candidate_control_access(v_actor_id)");
    expect(migration).toContain("public.user_can_manage_recruitment_case(v_actor_id, v_candidate.recruitment_case_id)");
    expect(migration).toContain("if v_candidate.released_without_folio_at is not null then");
    expect(migration).toContain("candidate_released_without_folio");
    expect(migration).toContain("perform public.sync_recruitment_case_status(v_candidate.recruitment_case_id, v_actor_id)");
    expect(migration).toContain("revoke all on function public.release_candidate_without_folio(uuid, text) from public, anon");
    expect(migration).toContain("grant execute on function public.release_candidate_without_folio(uuid, text) to authenticated");
    expect(migration).toContain("v_candidate.stage_code in ('hired', 'rejected', 'withdrawn')");
  });

  it("exposes the action only from the existing transfer flow", () => {
    expect(service).toContain('supabase.rpc("release_candidate_without_folio"');
    expect(modal).toContain("Dejar en Sin Folio");
    expect(modal).toContain("releaseCandidateWithoutFolio");
    expect(modal).toContain("candidate.is_without_folio");
  });
});
