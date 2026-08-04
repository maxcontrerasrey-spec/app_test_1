import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Solicitud de Contratación ERP", () => {
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
});
