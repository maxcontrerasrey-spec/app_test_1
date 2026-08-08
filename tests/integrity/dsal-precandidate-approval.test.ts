import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260808030657_enforce_dsal_precandidate_folio_capacity.sql"),
  "utf8"
);
const approvalView = fs.readFileSync(
  path.join(root, "src/modules/recruitment/components/HiringPrecandidatesView.tsx"),
  "utf8"
);

describe("DSAL precandidate approval contract", () => {
  it("enforces folio ownership, effective capacity and transactional approval", () => {
    expect(migration).toContain("assert_dsal_precandidate_case_capacity");
    expect(migration).toContain("nullif(trim(coalesce(request_record.folio, '')), '')");
    expect(migration).toContain("get_recruitment_case_effective_metrics(p_case_id)");
    expect(migration).toContain("available_vacancies, 0) <= 0");
    expect(migration).toContain("Solicita a la gerencia respectiva la creación y aprobación del folio");
    expect(migration).toContain("perform public.assert_dsal_precandidate_case_capacity(p_case_id);");
    expect(migration).toContain("grant execute on function public.approve_recruitment_precandidate(uuid, uuid, text) to authenticated");
  });

  it("makes the no-folio operational path explicit in Control de Contrataciones", () => {
    expect(approvalView).toContain("Folio de contratación destino");
    expect(approvalView).toContain("placeholder=\"Selecciona un folio con cupo\"");
    expect(approvalView).toContain("No hay folios de contratación aprobados con cupo disponible");
    expect(approvalView).toContain("gerencia respectiva la creación y aprobación del folio");
  });
});
