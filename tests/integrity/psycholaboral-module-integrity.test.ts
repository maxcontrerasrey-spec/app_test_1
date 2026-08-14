import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260813180211_add_psycholaboral_module.sql", "utf8");
const aiMigration = readFileSync("supabase/migrations/20260814005242_psych_ai_interpretation_foundation.sql", "utf8");
const serviceResetMigration = readFileSync("supabase/migrations/20260814021446_add_psycholaboral_service_certificate_reset.sql", "utf8");
const semanticGuardrailMigration = readFileSync("supabase/migrations/20260814030634_psych_ai_semantic_guardrails_v3.sql", "utf8");
const openAIProviderMigration = readFileSync("supabase/migrations/20260814032407_psych_ai_openai_gpt5_mini_provider.sql", "utf8");
const v5Migration = readFileSync("supabase/migrations/20260814041907_psych_ai_v5_methodological_reconstruction.sql", "utf8");
const v52Migration = readFileSync("supabase/migrations/20260814045629_psych_ai_v5_2_humanization_token_audit.sql", "utf8");
const edge = readFileSync("supabase/functions/psycholaboral-assessment/index.ts", "utf8");
const psychAiIndex = readFileSync("supabase/functions/_shared/psychAi/index.ts", "utf8");
const psychAi = readFileSync("supabase/functions/_shared/psychAi/providers.ts", "utf8");
const psychAiGuardrails = readFileSync("supabase/functions/_shared/psychAi/guardrails.ts", "utf8");
const psychAiSemantic = readFileSync("supabase/functions/_shared/psychAi/semantic.ts", "utf8");
const certificate = readFileSync("supabase/functions/generate-psycholaboral-certificate/index.ts", "utf8");
const resultDialog = readFileSync("src/modules/psycholaboral/components/PsychResultDialog.tsx", "utf8");
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

  it("agrega IA psicolaboral en tablas privadas sin exponer payload sensible", () => {
    expect(aiMigration).toContain("create table if not exists private.psych_ai_interpretations");
    expect(aiMigration).toContain("create table if not exists private.psych_ai_runs");
    expect(aiMigration).toContain("create table if not exists private.psych_prompt_versions");
    expect(aiMigration).toContain("create table if not exists private.psych_job_profile_versions");
    expect(aiMigration).toContain("revoke all on private.psych_ai_interpretations from public, anon, authenticated");
    expect(aiMigration).toContain("grant execute on function public.get_psych_ai_input_payload(uuid) to service_role");
    expect(psychAiGuardrails).toContain("delete cloned.national_id");
    expect(psychAiGuardrails).toContain("delete cloned.raw_answers");
    expect(psychAiGuardrails).toContain("delete cloned.responses");
  });

  it("mantiene la IA como interpretación revisable, no como scoring ni decisión", () => {
    expect(aiMigration).toContain("NOT_REQUESTED");
    expect(aiMigration).toContain("PENDING_REVIEW");
    expect(aiMigration).toContain("VALIDATED");
    expect(aiMigration).toContain("reviewed_output");
    expect(psychAiGuardrails).toContain("decisión automática");
    expect(psychAiGuardrails).toContain("decision_word");
    expect(psychAiGuardrails).toContain("clinical_word");
    expect(edge).toContain('action === "generate_ai_interpretation"');
    expect(edge).toContain("claim_psych_ai_interpretation");
    expect(edge).toContain("complete_psych_ai_interpretation");
  });

  it("genera IA automaticamente al completar la bateria y no expone boton manual", () => {
    const managementPage = readFileSync(
      "src/modules/psycholaboral/pages/PsycholaboralManagementPage.tsx",
      "utf8",
    );
    expect(edge).toContain("await runPsychAIInterpretation(admin, session.assessment_id!, null)");
    expect(edge).toContain("EdgeRuntime.waitUntil(postCompletionJob)");
    expect(edge).toContain('action === "internal_generate_ai_interpretation"');
    expect(edge).toContain('action === "internal_regenerate_certificate"');
    expect(edge).toContain("reset_psycholaboral_certificate_service");
    expect(serviceResetMigration).toContain("grant execute on function public.reset_psycholaboral_certificate_service(uuid) to service_role");
    expect(serviceResetMigration).toContain("revoke all on function public.reset_psycholaboral_certificate_service(uuid) from public, anon, authenticated");
    expect(edge).toContain("PSYCH_AI_INTERNAL_WEBHOOK_SECRET");
    expect(edge).toContain('request.headers.get("x-internal-secret")');
    expect(managementPage).not.toContain("Generar IA");
    expect(managementPage).toContain("IA automática:");
  });

  it("no muestra fallback tecnico fallido como interpretación profesional", () => {
    expect(resultDialog).toContain("detail.ai_interpretation?.display_output");
    expect(resultDialog).not.toContain("invalid JSON schema");
  });

  it("implementa proveedor Mock y OpenAI GPT-5 mini con schema estricto y feature flag", () => {
    expect(psychAi).toContain("class MockPsychInterpretationProvider");
    expect(psychAi).toContain("class OpenAIPsychInterpretationProvider");
    expect(psychAi).toContain("OPENAI_API_KEY");
    expect(psychAi).toContain("https://api.openai.com/v1");
    expect(psychAi).toContain("PSYCH_AI_ENABLED");
    expect(psychAi).toContain("gpt-5-mini");
    expect(psychAi).toContain('fetch(`${this.baseUrl}/responses`');
    expect(psychAi).toContain("text: {");
    expect(psychAi).toContain("max_output_tokens");
    expect(psychAi).toContain("reasoning");
    expect(psychAi).toContain("low");
    expect(psychAi).toContain("json_schema");
    expect(psychAi).toContain("openai_incomplete_");
    expect(psychAi).toContain("openai_refusal_");
    expect(edge).toContain('Deno.env.get("PSYCH_AI_PROVIDER")?.trim().toLowerCase() === "openai"');
    expect(edge).toContain('Deno.env.get("OPENAI_API_KEY")?.trim()');
  });

  it("usa guardrails semánticos V3 con evidencia obligatoria y fallback revisable", () => {
    expect(semanticGuardrailMigration).toContain("psych-ai-prompt-v3");
    expect(semanticGuardrailMigration).toContain("psych-ai-schema-v3");
    expect(semanticGuardrailMigration).toContain("evidence_ids");
    expect(semanticGuardrailMigration).toContain("INTERMEDIO_EN_RANGO_TEORICO");
    expect(semanticGuardrailMigration).toContain("SOBRE_EL_PROMEDIO");
    expect(semanticGuardrailMigration).toContain("PROFESSIONAL_ONLY");
    expect(psychAiSemantic).toContain("buildPsychSemanticContext");
    expect(psychAiSemantic).toContain("validatePsychSemanticOutput");
    expect(psychAiSemantic).toContain("prp_descriptive_interpretation_allowed");
    expect(psychAiSemantic).toContain("ipc_directive_second_regression");
    expect(psychAiGuardrails).toContain("attachPsychSemanticContext");
    expect(psychAiGuardrails).toContain("buildDeterministicPsychSemanticOutput");
    expect(psychAiIndex).toContain("provider_failed_fallback_used");
    expect(psychAiIndex).toContain("success: !liveConfigured");
    expect(psychAiIndex).toContain("gpt5-mini-humanized-v5.2");
    expect(psychAiIndex).toContain("ANALYST_SYSTEM_PROMPT");
    expect(psychAiIndex).toContain("REVIEWER_SYSTEM_PROMPT");
    expect(psychAiIndex).toContain("reviewer_failed_bypassed");
    expect(psychAiIndex).toContain("REVIEW_PATCH_SCHEMA");
    expect(psychAiIndex).toContain("buildCompactPsychAIFacts");
    expect(edge).toContain("p_output: generated.success ? generated.output : null");
  });

  it("activa OpenAI GPT-5 mini como proveedor productivo psicolaboral", () => {
    expect(openAIProviderMigration).toContain("psych-ai-prompt-v4");
    expect(openAIProviderMigration).toContain("psych-ai-schema-v3");
    expect(openAIProviderMigration).toContain("'openai'");
    expect(openAIProviderMigration).toContain("'gpt-5-mini'");
    expect(openAIProviderMigration).toContain("notify pgrst, 'reload schema'");
  });

  it("reconstruye metodología V5 con informe integrado y PRP descriptivo", () => {
    const audit = readFileSync(
      "docs/psychometric-module/PSYCH_V5_SOURCE_AND_IMPLEMENTATION_AUDIT.md",
      "utf8",
    );
    expect(v5Migration).toContain("psych-ai-prompt-v5");
    expect(v5Migration).toContain("psych-ai-schema-v5");
    expect(v5Migration).toContain("executive_profile");
    expect(v5Migration).toContain("safety_and_impulse_profile");
    expect(v5Migration).toContain("integrated_conclusion");
    expect(v5Migration).toContain("automatic_interpretation_allowed=true");
    expect(psychAiSemantic).toContain("psych-methodology-v5");
    expect(psychAiSemantic).toContain("PRP puede interpretarse descriptivamente");
    expect(psychAiSemantic).not.toContain("prp_hard_lock_missing");
    expect(v52Migration).toContain("psych-ai-prompt-v5.2");
    expect(v52Migration).toContain("psych-ai-schema-v5.2");
    expect(v52Migration).toContain("analyst_input_tokens");
    expect(v52Migration).toContain("reviewer_executed");
    expect(v52Migration).toContain("p_metadata jsonb default '{}'::jsonb");
    expect(psychAiIndex).toContain("El objeto del informe es la persona en contexto laboral");
    expect(psychAiIndex).toContain("reviewer_executed:");
    expect(psychAiIndex).toContain("needsReviewer(analystFlags)");
    expect(psychAiIndex).toContain("PRP puede aportar lectura descriptiva preventiva");
    expect(psychAiGuardrails).toContain("delete cloned.prompt");
    expect(psychAiGuardrails).toContain("buildCompactPsychAIFacts");
    expect(psychAiGuardrails).toContain("backend_meta_language");
    expect(psychAiGuardrails).toContain("raw_technical_language");
    expect(audit).toContain("Evaluación de Personalidad IPIP-16");
    expect(audit).toContain("No es DISC ni Everything DiSC");
    expect(audit).toContain("Interpretación descriptiva habilitada");
  });

  it("genera informe interno de cuatro páginas con IA/fallback y disclaimers", () => {
    expect(certificate).toContain("Pagina ${pageNumber} de 4");
    expect(certificate).toContain("defaultAIOutput");
    expect(certificate).toContain("drawBarChart");
    expect(certificate).toContain("drawRadar");
    expect(certificate).toContain("BIS-11, PRP e integracion");
    expect(certificate).toContain("Este modelo interno no corresponde a DISC");
    expect(certificate).toContain("payload.ai_interpretation?.display_output");
  });
});
