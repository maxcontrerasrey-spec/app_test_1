import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260722183930_core_data_integrity_hardening.sql"),
  "utf8"
);
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("CORE data integrity", () => {
  it("closes direct client mutation paths that bypass canonical RPCs", () => {
    expect(migration).toContain('drop policy if exists "hiring_requests_insert_requester"');
    expect(migration).toContain('drop policy if exists "candidate_documents_update_scoped"');
    expect(migration).toContain("revoke insert, update, delete, truncate, references, trigger");
    expect(migration).toContain("public.employee_onboarding_activity_log");
  });

  it("promotes workflow and terminal-reason invariants to database checks", () => {
    expect(migration).toContain("hiring_requests_state_metadata_integrity");
    expect(migration).toContain("recruitment_candidate_terminal_reason_integrity");
    expect(migration).toContain("status = 'approved' and current_step_code is null and approved_at is not null");
    expect(migration).toContain("stage_code <> 'withdrawn'");
  });

  it("keeps audit-only snapshot data behind RLS", () => {
    expect(migration).toContain(
      "alter table public.buk_employee_snapshot_compaction_audit enable row level security"
    );
    expect(migration).toContain(
      "revoke all on public.buk_employee_snapshot_compaction_audit from public, anon, authenticated"
    );
  });

  it("records durable intent before destructive document cleanup", () => {
    const purge = read("supabase/functions/purge-candidate-documents/index.ts");
    expect(purge.indexOf('phase: "purge_intent_recorded"')).toBeLessThan(
      purge.indexOf('.from("candidate-docs")\n      .remove(filePaths)')
    );
    expect(purge).toContain("document_ids: documents.map");
    expect(purge).toContain("storage_paths: filePaths");
  });

  it("persists BUK checkpoints before deleting local source documents", () => {
    const sync = read("supabase/functions/sync-buk-candidates/index.ts");
    const checkpoint = sync.indexOf("jobResultSnapshot.documents = uploadedDocuments");
    const removal = sync.indexOf('.from("candidate-docs")\n      .remove([document.file_path])', checkpoint);
    expect(checkpoint).toBeGreaterThan(0);
    expect(removal).toBeGreaterThan(checkpoint);
  });

  it("does not finish BUK hiring jobs before uniform sizes are persisted and verified", () => {
    const sync = read("supabase/functions/sync-buk-candidates/index.ts");
    const reconciliation = sync.indexOf(
      "const uniformSizes = await syncBukEmployeeUniformSizes(payload, employeeId)"
    );
    const setup = sync.indexOf("const setupResult = await ensureBukEmployeeSetup", reconciliation);
    const finalization = sync.indexOf("await finalizeSuccessfulJob", reconciliation);

    expect(sync).toContain('shoeSize: "Numero Calzado"');
    expect(sync).toContain('pantsSize: "Talla Pantalón"');
    expect(sync).toContain('shirtSize: "Talla Polera"');
    expect(sync.match(/custom_attributes: buildBukUniformSizeAttributes\(payload\)/g)).toHaveLength(2);
    expect(reconciliation).toBeGreaterThan(0);
    expect(setup).toBeGreaterThan(reconciliation);
    expect(finalization).toBeGreaterThan(setup);
    expect(sync).toContain('method: "PATCH"');
    expect(sync).toContain("const employeeBefore = await fetchBukEmployeeById(employeeId)");
    expect(sync).toContain("if (hasExpectedBukAttributes(attributesBefore, customAttributes))");
    expect(sync).toContain("hasPreservedBukAttributes(attributesBefore, verifiedAttributes)");
    expect(sync).toContain("signal: AbortSignal.timeout(15_000)");
    expect(sync).toContain("const employee = await fetchBukEmployeeById(employeeId)");
  });

  it("normalizes formatted phone numbers before sending employees to BUK", () => {
    const sync = read("supabase/functions/sync-buk-candidates/index.ts");
    expect(sync).toContain("function normalizeBukPhone(value: string | null | undefined)");
    expect(sync).toContain("const digits = (value ?? \"\").replace(/[^0-9]/g, \"\")");
    expect(sync).toContain("office_phone: normalizeBukPhone(profile.office_phone) || undefined");
    expect(sync).toContain("phone: normalizeBukPhone(profile.phone) || undefined");
  });

  it("persists accreditation upload operations behind RLS", () => {
    const uploadMigration = read(
      "supabase/migrations/20260722184849_add_accreditation_document_upload_jobs.sql"
    );
    expect(uploadMigration).toContain("operation_key text not null unique");
    expect(uploadMigration).toContain("status in ('pending', 'processing', 'buk_uploaded', 'success', 'error')");
    expect(uploadMigration).toContain("enable row level security");
    expect(uploadMigration).toContain("from public, anon, authenticated");
  });

  it("blocks BUK generation when a recruitment case has no available vacancies", () => {
    const bukCapacityMigration = read(
      "supabase/migrations/20260729150153_guard_buk_generation_vacancy_overfill.sql"
    );

    expect(bukCapacityMigration).toContain(
      "create or replace function public.get_recruitment_case_buk_capacity_snapshot"
    );
    expect(bukCapacityMigration).toContain("p_excluded_candidate_id uuid default null");
    expect(bukCapacityMigration).toContain("public.is_effective_buk_generation_success");
    expect(bukCapacityMigration).toContain("bsj.status = 'processing'");
    expect(bukCapacityMigration).toContain("bsj.status in ('pending', 'processing')");
    expect(bukCapacityMigration).toContain("p_include_pending_jobs and bsj.status = 'pending'");
    expect(bukCapacityMigration).toContain(
      "public.get_recruitment_case_buk_capacity_snapshot(\n        candidate_row.recruitment_case_id,\n        candidate_row.id,\n        true\n      )"
    );
    expect(bukCapacityMigration).toContain(
      "No hay cupos disponibles para generar en BUK en el caso %"
    );
  });
});
