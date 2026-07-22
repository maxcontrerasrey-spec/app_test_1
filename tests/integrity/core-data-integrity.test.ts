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

  it("persists accreditation upload operations behind RLS", () => {
    const uploadMigration = read(
      "supabase/migrations/20260722184849_add_accreditation_document_upload_jobs.sql"
    );
    expect(uploadMigration).toContain("operation_key text not null unique");
    expect(uploadMigration).toContain("status in ('pending', 'processing', 'buk_uploaded', 'success', 'error')");
    expect(uploadMigration).toContain("enable row level security");
    expect(uploadMigration).toContain("from public, anon, authenticated");
  });
});
