import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260808032030_allow_dsal_precandidate_reviewers_and_expand_details.sql"),
  "utf8"
);
const recruitmentOnlyAccessMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260821145714_restrict_precandidate_access_to_recruitment.sql"),
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
const duplicateSubmissionMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260808033755_prevent_duplicate_dsal_precandidate_submissions.sql"),
  "utf8"
);
const rosterJudicialMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260808040122_add_dsal_roster_judicial_data.sql"),
  "utf8"
);
const publicApplication = fs.readFileSync(
  path.join(root, "src/modules/recruitment/pages/DsalPublicApplicationPage.tsx"),
  "utf8"
);
const nonRosterMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260809161820_allow_non_roster_dsal_precandidate_submissions.sql"),
  "utf8"
);
const expandedRosterMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260810170000_expand_dsal_roster_roles.sql"),
  "utf8"
);

describe("DSAL precandidate approval contract", () => {
  it("limits management access to the recruitment role", () => {
    expect(recruitmentOnlyAccessMigration).toContain("user_has_role(actor_id, 'reclutamiento')");
    expect(recruitmentOnlyAccessMigration).toContain("current_user_id <> actor_id");
    expect(recruitmentOnlyAccessMigration).toContain("solo están disponibles para Reclutamiento");
  });

  it("keeps precandidates visible and operable for super administrators", () => {
    const superAdminMigration = fs.readFileSync(
      path.join(root, "supabase/migrations/20260822160458_restore_precandidate_access_for_super_admin.sql"),
      "utf8"
    );

    expect(statusPage).toContain("isSuperAdmin || appRoles.includes(\"reclutamiento\")");
    expect(superAdminMigration).toContain("profile.is_super_admin = true");
    expect(superAdminMigration).toContain("or public.user_has_role(actor_id, 'reclutamiento')");
  });

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
    expect(migration).toContain("user_has_role(actor_id, 'reclutamiento')");
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
    expect(approvalView).not.toContain("reviewComment");
    expect(approvalView).not.toContain("id={`precandidate-comment-");
    expect(approvalView).toContain("precandidate-resolution-fields");
    expect(statusPage).toContain('appRoles.includes("reclutamiento")');
  });

  it("blocks a second submission by RUT at the database boundary", () => {
    expect(duplicateSubmissionMigration).toContain(
      "idx_recruitment_precandidates_national_id_all"
    );
    expect(duplicateSubmissionMigration).toContain(
      "Este RUT ya registra una postulación y no puede volver a enviarse"
    );
    expect(duplicateSubmissionMigration).not.toContain("on conflict (national_id) where status = 'pending'");
    expect(duplicateSubmissionMigration).toContain("when unique_violation then");
  });

  it("keeps roster identity and judicial data backend-authoritative", () => {
    expect(rosterJudicialMigration).toContain("create table if not exists public.recruitment_dsal_roster");
    expect(rosterJudicialMigration).toContain("get_dsal_roster_identity");
    expect(rosterJudicialMigration).toContain("El RUT no se encuentra en la nómina vigente del contrato DSAL");
    expect(rosterJudicialMigration).toContain("roster_record.first_name");
    expect(rosterJudicialMigration).toContain("recruitment_dsal_judicial_summary");
    expect(rosterJudicialMigration).toContain("recruitment_dsal_judicial_causes");
    expect(rosterJudicialMigration).toContain("criminal_cause_count");
    expect(rosterJudicialMigration).toContain("criminal_cause_details");
    expect(rosterJudicialMigration).toContain("using (false) with check (false)");
    expect(publicApplication).toContain("fetchDsalRosterIdentity");
    expect(publicApplication).toContain('disabled={rosterLookupStatus === "found" || rosterLookupStatus === "loading"}');
    expect(publicApplication).toContain("rosterLookupStatus === \"found\"");
    expect(approvalView).toContain("precandidate-judicial-bubble-${tone}");
    expect(approvalView).toContain("Causas criminales");
    expect(approvalView).toContain("Causas laborales");
  });

  it("allows valid non-roster RUTs while preserving normalization and roster locking", () => {
    expect(nonRosterMigration).toContain("Los RUT que no aparecen en la nomina vigente");
    expect(nonRosterMigration).toContain("roster_match := roster_record.national_id is not null");
    expect(nonRosterMigration).toContain("if roster_match then");
    expect(nonRosterMigration).toContain("normalized_first_name := roster_record.first_name");
    expect(nonRosterMigration).toContain("normalized_first_name text := public.normalize_dsal_precandidate_name(p_first_name)");
    expect(nonRosterMigration).not.toContain("raise exception 'El RUT no se encuentra en la nómina vigente del contrato DSAL'");
    expect(publicApplication).toContain('(rosterLookupStatus === "found" || rosterLookupStatus === "not_found")');
    expect(publicApplication).toContain("Puedes continuar: completa tus nombres y apellidos");
  });

  it("amplia la nómina ECO04 y mantiene roles/judicial por RUT", () => {
    expect(expandedRosterMigration).toContain("184036991");
    expect(expandedRosterMigration).toContain("Camilo Nicolas");
    expect(expandedRosterMigration).toContain("Administrador de Contrato");
    expect(expandedRosterMigration).toContain("Mecánico especialista carrocería");
    expect(expandedRosterMigration).toContain("is_valid_dsal_precandidate_role");
    expect(expandedRosterMigration).toContain(
      "coalesce(public.normalize_dsal_precandidate_name(p_second_last_name), '')"
    );
    expect(approvalView).toContain("criminal_cause_count");
    expect(approvalView).toContain("labor_cause_count");
  });
});
