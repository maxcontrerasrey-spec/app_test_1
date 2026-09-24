import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Solicitud de Contratación ERP", () => {
  const backfillMigrationPath =
    "supabase/migrations/20260804145954_add_hiring_document_backfill.sql";
  const hardeningMigrationPath =
    "supabase/migrations/20260804151115_harden_hiring_document_backfill_finalization.sql";

  it("reserva un único documento activo por candidato y usa token no enumerable", () => {
    const migration = read("supabase/migrations/20260804141923_add_hiring_request_documents.sql");
    expect(migration).toContain("idx_recruitment_hiring_documents_active_candidate");
    expect(migration).toContain("verification_token uuid not null unique default gen_random_uuid()");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("verify_recruitment_hiring_document");
    expect(migration).not.toContain("where upper(rhd.folio)");
  });

  it("bloquea reintentos automáticos cuando BUK deja un resultado incierto", () => {
    const edge = read("supabase/functions/sync-buk-candidates/index.ts");
    expect(edge).toContain('row.buk_upload_status === "reconciliation_required"');
    expect(edge).toContain('row.buk_upload_status === "processing"');
    expect(edge).toContain("Se detectó una carga BUK anterior sin resultado confirmado");
    expect(edge).toContain('"reconciliation_required" : "failed"');
    expect(edge).toContain("loadUploadedDocumentsAcrossJobs");
    expect(edge).toContain("jobResultSnapshot.hiringRequestDocument = checkpoint");
  });

  it("publica solo una lista mínima y nunca sueldo ni adjuntos", () => {
    const builder = read("supabase/functions/_shared/recruitmentHiringDocument.ts");
    const publicBuilder = builder.slice(builder.indexOf("export function buildRecruitmentHiringPublicSnapshot"));
    expect(publicBuilder).toContain("document_number_masked");
    expect(publicBuilder).not.toContain("net_salary");
    expect(publicBuilder).not.toContain("documents:");
    expect(publicBuilder).not.toContain("buk_document_url");
  });

  it("mantiene las RPC privadas detrás de service_role", () => {
    const migration = read("supabase/migrations/20260804141923_add_hiring_request_documents.sql");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.verify_recruitment_hiring_document(text) to service_role");
    expect(migration).toContain("revoke all on function public.verify_competency_certificate(text)");
  });

  it("limita el backfill histórico al bucket Personal contratado con BUK efectivo", () => {
    const migration = read(backfillMigrationPath);
    expect(migration).toContain("rcc.stage_code = 'hired'");
    expect(migration).toContain("is_effective_buk_generation_success");
    expect(migration).toContain("document_validation_status = 'approved'");
    expect(migration).toContain("get_recruitment_hiring_document_backfill_candidates");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("reconstruye documentos históricos desde checkpoints BUK confirmados", () => {
    const migration = read(backfillMigrationPath);
    expect(migration).toContain("history_job.result_snapshot -> 'documents'");
    expect(migration).toContain("history_job.payload_snapshot -> 'documents'");
    expect(migration).toContain("uploaded_document ->> 'sourceDocumentId'");
    expect(migration).toContain("between 200 and 299");
  });

  it("ejecuta el backfill sin mutar el job BUK histórico ni custodiar el PDF", () => {
    const edge = read("supabase/functions/sync-buk-candidates/index.ts");
    const backfill = edge.slice(
      edge.indexOf("async function runHiringDocumentBackfill"),
      edge.indexOf("Deno.serve")
    );
    const documentProcessor = edge.slice(
      edge.indexOf("async function processRecruitmentHiringDocument"),
      edge.indexOf("function extractUploadedDocumentsFromSnapshot")
    );
    expect(edge).toContain('mode?: "sync" | "documents" | "hiring_document_backfill"');
    expect(edge).toContain("HIRING_DOCUMENT_BACKFILL_SECRET");
    expect(edge).toContain("safeSecretEquals(suppliedBackfillSecret, backfillSecret)");
    expect(edge).toContain("persistSourceJobCheckpoint: false");
    expect(edge).toContain('origin: "historical_backfill"');
    expect(edge).toContain('.in("buk_upload_status", ["pending", "failed"])');
    expect(backfill).not.toContain(".storage");
    expect(backfill).not.toContain("markJobState");
    expect(documentProcessor).not.toContain(".storage");
  });

  it("cierra éxito, purga y auditoría en una única transacción SQL", () => {
    const migration = read(hardeningMigrationPath);
    expect(migration).toContain("finalize_recruitment_hiring_document_buk_success");
    expect(migration).toContain("for update");
    expect(migration).toContain("source_snapshot_purged_at = uploaded_at");
    expect(migration).toContain("recruitment_hiring_documents_success_snapshot_purged_check");
    expect(migration).toContain("insert into public.recruitment_hiring_document_audit_log");
    expect(migration).toContain("revoke all on sequence public.recruitment_hiring_document_audit_log_id_seq");
  });

  it("no vuelve reintentable una carga BUK ambigua ni roba claims recientes", () => {
    const edge = read("supabase/functions/sync-buk-candidates/index.ts");
    expect(edge).toContain("explicitStatus === 408 || explicitStatus === 429 || explicitStatus >= 500");
    expect(edge).toContain("Date.now() - processingStartedAt < 30 * 60 * 1000");
    expect(edge).toContain('.eq("buk_upload_status", "processing")');
    expect(edge).toContain('buk_upload_status: "reconciliation_required"');
  });

  it("reconcilia el documento remoto antes de habilitar un reintento", () => {
    const documents = read("supabase/functions/_shared/bukDocuments.ts");
    const edge = read("supabase/functions/sync-buk-candidates/index.ts");

    expect(documents).toContain("export async function reconcileBukDocumentUpload");
    expect(documents).toContain("Buk document reconciliation timeout");
    expect(documents).toContain("documentRowName");
    expect(documents).toContain("payload.employee_files");
    expect(documents).toContain("row.filename");
    expect(documents).not.toContain("const value = row.path ?? row.folder");
    expect(edge).toContain("reconcileBukDocumentUpload(employeeId, fileName, { path: \"Postulación\" })");
    expect(edge).toContain('eventType: "buk_reconciliation_not_found"');
    expect(edge).toContain('buk_upload_status: "failed"');
    expect(edge).toContain('transport: "reconciled_remote"');
    expect(edge).toContain("requireBukDocumentMetadata");
    expect(edge).toContain("requireBukDocumentReference");
    expect(edge).toContain("legacyServiceRoleKey");
    expect(edge).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(edge).toContain("BUK_DOCUMENT_QUEUE_WEBHOOK_SECRET");
    expect(edge).toContain("isDocumentQueueInvocation");
    expect(edge).toContain('mode === "documents"');
    expect(documents).toContain("export function requireBukDocumentMetadata");
  });

  it("separa documentos generales en una cola acotada y reintentable", () => {
    const edge = read("supabase/functions/sync-buk-candidates/index.ts");
    const client = read("src/modules/recruitment/services/hiringBukProfile.ts");
    const migration = read(
      "supabase/migrations/20260924110000_separate_buk_candidate_document_queue.sql"
    );

    expect(edge).toContain('if (mode === "documents")');
    expect(edge).toContain("enqueueCandidateDocumentJobs");
    expect(edge).toContain("runCandidateDocumentQueue");
    expect(edge).toContain("isAmbiguousBukDocumentError");
    expect(edge).not.toContain("await processDocuments(");
    expect(client.match(/await getSupabaseFunctionErrorMessage\(/g)).toHaveLength(3);
    expect(migration).toContain("claim_buk_candidate_document_jobs");
    expect(migration).toContain("max_concurrency integer not null default 3");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("reconciliation_required");
  });

  it("mantiene la RPC de encolado ejecutable despues del despliegue", () => {
    const migration = read(
      "supabase/migrations/20260924133000_fix_buk_candidate_document_queue_enqueue.sql"
    );

    expect(migration).toContain("source_document_id,\n      source_document_name");
    expect(migration).toContain("normalized_employee_id,\n      v_source_document_id,");
    expect(migration).not.toContain("v_source_document_id,\n      source_document_name");
    expect(migration).toContain("grant execute on function public.enqueue_buk_candidate_document_jobs");

    const hardeningMigration = read(
      "supabase/migrations/20260924143000_harden_buk_candidate_document_queue_enqueue.sql"
    );
    expect(hardeningMigration).toContain("jsonb_array_length(\n              case");
    expect(hardeningMigration).toContain("jsonb_typeof(coalesce(p_existing_documents");

    const retryMigration = read(
      "supabase/migrations/20260924150000_add_buk_document_retry_backoff.sql"
    );
    expect(retryMigration).toContain("next_attempt_at");
    expect(retryMigration).toContain("next_attempt_at = case");
  });
});
