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
      edge.indexOf("async function processDocuments")
    );
    expect(edge).toContain('mode?: "sync" | "hiring_document_backfill"');
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
});
