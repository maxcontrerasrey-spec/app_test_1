import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260813180211_add_psycholaboral_module.sql", "utf8");
const edge = readFileSync("supabase/functions/psycholaboral-assessment/index.ts", "utf8");
const router = readFileSync("src/app/router/AppRouter.tsx", "utf8");
const access = readFileSync("src/modules/auth/config/access.ts", "utf8");

describe("Gestión Psicolaboral", () => {
  it("registra un módulo independiente y protege su ruta", () => {
    expect(migration).toContain("'gestion_psicolaboral'");
    expect(router).toContain('moduleCode="gestion_psicolaboral"');
    expect(access).toContain('| "gestion_psicolaboral"');
  });

  it("mantiene datos sensibles en esquema privado y sin grants directos", () => {
    expect(migration).toContain("create table private.psychometric_assessments");
    expect(migration).toContain("revoke all on all tables in schema private from public,anon,authenticated");
    expect(migration).not.toMatch(/grant\s+(select|insert|update|delete|all)\s+on\s+.*psychometric.*\s+to\s+(anon|authenticated)/i);
  });

  it("usa una sesión opaca de 90 minutos y código de un solo uso", () => {
    expect(migration).toContain("invite_consumed_at is not null");
    expect(migration).toContain("deadline_at=nowv+interval '90 minutes'");
    expect(edge).toContain("p_invite_hash: await sha256");
    expect(edge).toContain("p_session_hash: await sha256(sessionToken)");
  });

  it("exige ambos consentimientos antes de entregar preguntas", () => {
    expect(migration).toContain("psychometric_assessment_consents");
    expect(migration).toContain("c.document_sha256=supplied->>'document_sha256'");
    expect(migration).toContain("Debes aceptar los consentimientos antes de responder");
    expect(migration).toContain("'F-RH-061'");
    expect(migration).toContain("'F-RH-062'");
    expect(migration).toContain("count(distinct c.id)");
  });

  it("mantiene operativos los RPC service-role y usa funciones PostgreSQL válidas", () => {
    expect(migration).not.toContain("current_user<>'service_role'");
    expect(migration).not.toContain("jsonb_object_length(");
    expect(migration).toContain("extensions.digest(");
    expect(migration).toContain("private.jsonb_object_size");
  });

  it("no automatiza el rechazo por puntaje y usa la transición oficial", () => {
    expect(migration).toContain("perform public.advance_recruitment_candidate_stage(a.recruitment_case_candidate_id,'rejected',commentv)");
    expect(migration).toContain("p_decision not in ('approved','rejected')");
    expect(migration).not.toMatch(/score[^;]{0,180}advance_recruitment_candidate_stage/is);
  });

  it("mantiene PRP en revisión profesional", () => {
    expect(migration).toContain("'pending_professional_review'");
  });

  it("mantiene certificados privados, recuperables y con descarga de alcance exacto", () => {
    expect(edge).toContain('action === "generate_certificate"');
    expect(edge).toContain('action === "certificate_url"');
    expect(edge).toContain(".createSignedUrl(item.path, 60)");
    expect(migration).toContain("certificate_claim_token=p_claim_token");
    expect(migration).not.toContain("create policy psychometric_documents_select_authorized");
  });

  it("hace reintentable el envío sin cambiar el código temporal", () => {
    expect(edge).toContain("deterministicAccessCode");
    expect(edge).toContain('`psycholaboral/${prepared.assessment_id}`');
    expect(edge).toContain('"Idempotency-Key": input.idempotencyKey');
  });
});
