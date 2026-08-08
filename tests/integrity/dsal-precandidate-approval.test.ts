import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260808032030_allow_dsal_precandidate_reviewers_and_expand_details.sql"),
  "utf8"
);
const approvalView = fs.readFileSync(
  path.join(root, "src/modules/recruitment/components/HiringPrecandidatesView.tsx"),
  "utf8"
);
const statusPage = fs.readFileSync(
  path.join(root, "src/modules/recruitment/pages/HiringStatusPage.tsx"),
  "utf8"
);

describe("DSAL precandidate approval contract", () => {
  it("enforces folio ownership, effective capacity and transactional approval", () => {
    expect(migration).toContain("assert_dsal_precandidate_case_capacity");
    expect(migration).toContain("upper(coalesce(case_record.contract_name, '')) not like '%DSAL%'");
    expect(migration).toContain("nullif(trim(coalesce(request_record.folio, '')), '')");
    expect(migration).toContain("get_recruitment_case_effective_metrics(p_case_id)");
    expect(migration).toContain("available_vacancies, 0) <= 0");
    expect(migration).toContain("Solicita a la gerencia respectiva la creación y aprobación del folio");
    expect(migration).toContain("perform public.assert_dsal_precandidate_case_capacity(p_case_id);");
    expect(migration).toContain("grant execute on function public.approve_recruitment_precandidate(uuid, uuid, text) to authenticated");
    expect(migration).toContain("user_can_review_dsal_precandidates");
    expect(migration).toContain("user_has_role(actor_id, 'director_op')");
    expect(migration).toContain("user_has_role(actor_id, 'reclutamiento')");
    expect(migration).toContain("cost_center_approvers");
  });

  it("makes the no-folio operational path explicit in Control de Contrataciones", () => {
    expect(approvalView).toContain("Folio de contratación DSAL destino");
    expect(approvalView).toContain("placeholder=\"Selecciona un folio con cupo\"");
    expect(approvalView).toContain("No hay folios DSAL aprobados con cupo disponible");
    expect(approvalView).toContain("gerencia");
    expect(approvalView).toContain("creación y aprobación del folio");
    expect(approvalView).toContain("expandedPrecandidateId");
    expect(approvalView).toContain("expanded-case-detail-grid");
    expect(approvalView).toContain("approved_folio");
    expect(statusPage).toContain('"gerencia", "director_op", "reclutamiento"');
  });
});
