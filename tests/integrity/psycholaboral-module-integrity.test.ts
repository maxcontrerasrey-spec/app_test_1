import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260813180211_add_psycholaboral_module.sql", "utf8");
const aiMigration = readFileSync("supabase/migrations/20260814005242_psych_ai_interpretation_foundation.sql", "utf8");
const serviceResetMigration = readFileSync("supabase/migrations/20260814021446_add_psycholaboral_service_certificate_reset.sql", "utf8");
const semanticGuardrailMigration = readFileSync("supabase/migrations/20260814030634_psych_ai_semantic_guardrails_v3.sql", "utf8");
const openAIProviderMigration = readFileSync("supabase/migrations/20260814032407_psych_ai_openai_gpt5_mini_provider.sql", "utf8");
const v5Migration = readFileSync("supabase/migrations/20260814041907_psych_ai_v5_methodological_reconstruction.sql", "utf8");
const v52Migration = readFileSync("supabase/migrations/20260814045629_psych_ai_v5_2_humanization_token_audit.sql", "utf8");
const v53Migration = readFileSync("supabase/migrations/20260814111606_psych_ai_v5_3_objectivity_pdf_redesign.sql", "utf8");
const v54Migration = readFileSync("supabase/migrations/20260814132317_psych_ai_v5_4_humanized_report.sql", "utf8");
const v61Migration = readFileSync("supabase/migrations/20260814163136_psych_ai_v6_1_luna_medium_robusto.sql", "utf8");
const v62Migration = readFileSync("supabase/migrations/20260814191200_psych_ai_v6_2_taxonomy_pdf_close.sql", "utf8");
const edge = readFileSync("supabase/functions/psycholaboral-assessment/index.ts", "utf8");
const psychAiIndex = readFileSync("supabase/functions/_shared/psychAi/index.ts", "utf8");
const psychAi = readFileSync("supabase/functions/_shared/psychAi/providers.ts", "utf8");
const psychAiGuardrails = readFileSync("supabase/functions/_shared/psychAi/guardrails.ts", "utf8");
const psychAiSemantic = readFileSync("supabase/functions/_shared/psychAi/semantic.ts", "utf8");
const certificate = readFileSync("supabase/functions/generate-psycholaboral-certificate/index.ts", "utf8");
const resultDialog = readFileSync("src/modules/psycholaboral/components/PsychResultDialog.tsx", "utf8");
const aiReviewDialog = readFileSync("src/modules/psycholaboral/components/PsychAIReviewDialog.tsx", "utf8");
const managementPage = readFileSync("src/modules/psycholaboral/pages/PsycholaboralManagementPage.tsx", "utf8");
const assessmentPage = readFileSync("src/modules/psycholaboral/pages/PsychometricAssessmentPage.tsx", "utf8");
const assessmentStyles = readFileSync("src/modules/psycholaboral/styles/psycholaboral.css", "utf8");
const router = readFileSync("src/app/router/AppRouter.tsx", "utf8");
const access = readFileSync("src/modules/auth/config/access.ts", "utf8");

describe("Gestión Psicolaboral", () => {
  it("identifica visualmente qué páginas tienen respuestas pendientes", () => {
    expect(assessmentPage).toContain("const blockCompletion = useMemo");
    expect(assessmentPage).toContain("Object.prototype.hasOwnProperty.call(answers, String(question.order))");
    expect(assessmentPage).toContain("psych-block-nav__button--complete");
    expect(assessmentPage).toContain("psych-block-nav__button--incomplete");
    expect(assessmentPage).toContain('aria-label={`Página ${index + 1}: ${');
    expect(assessmentStyles).toContain(".psych-block-nav__button--complete");
    expect(assessmentStyles).toContain(".psych-block-nav__button--incomplete");
    expect(assessmentStyles).toContain("button[aria-current=\"step\"]");
  });

  it("mantiene la columna de actualización como celda de tabla para no desalinear separadores", () => {
    expect(managementPage).toContain('td className="psych-update-cell"');
    expect(managementPage).toContain('className="psych-update-cell__content"');
    expect(assessmentStyles).toContain(".psych-update-cell{min-width:");
    expect(assessmentStyles).toContain(".psych-update-cell__content{display:flex;");
    expect(assessmentStyles).not.toContain(".psych-update-cell{display:flex");
  });

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
    expect(psychAiGuardrails).toContain("decision_word");
    expect(psychAiGuardrails).toContain("decision_word");
    expect(psychAiGuardrails).toContain("clinical_word");
    expect(edge).toContain('action === "generate_ai_interpretation"');
    expect(edge).toContain("claim_psych_ai_interpretation");
    expect(edge).toContain("complete_psych_ai_interpretation");
  });

  it("genera IA automaticamente al completar la bateria y no expone boton manual", () => {
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
    expect(managementPage).toContain("Informe:");
  });

  it("no muestra fallback tecnico fallido como interpretación profesional", () => {
    expect(resultDialog).toContain("detail.ai_interpretation?.display_output");
    expect(resultDialog).not.toContain("invalid JSON schema");
  });

  it("implementa proveedor Mock y OpenAI GPT-5.6 Luna con schema estricto y feature flag", () => {
    expect(psychAi).toContain("class MockPsychInterpretationProvider");
    expect(psychAi).toContain("class OpenAIPsychInterpretationProvider");
    expect(psychAi).toContain("OPENAI_API_KEY");
    expect(psychAi).toContain("https://api.openai.com/v1");
    expect(psychAi).toContain("PSYCH_AI_ENABLED");
    expect(psychAi).toContain('DEFAULT_PSYCH_AI_MODEL = "gpt-5.6-luna"');
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
    expect(psychAiIndex).toContain("gpt56-luna-medium-v6.2");
    expect(psychAiIndex).toContain("ANALYST_SYSTEM_PROMPT");
    expect(psychAiIndex).toContain("REVIEWER_SYSTEM_PROMPT");
    expect(psychAiIndex).toContain("reviewer_failed_bypassed");
    expect(psychAiIndex).toContain("REVIEW_PATCH_SCHEMA");
    expect(psychAiIndex).toContain("buildCompactPsychAIFacts");
    expect(edge).toContain("p_output: generated.success ? generated.output : null");
  });

  it("implementa V6.1 con rangos PRP y convergencia", () => {
    expect(v61Migration).toContain("psych-ai-prompt-v6.1");
    expect(v61Migration).toContain("psych-ai-schema-v6.1");
    expect(v61Migration).toContain("81");
    expect(v61Migration).toContain("117");
    expect(v61Migration).toContain("118");
    expect(v61Migration).toContain("136");
    expect(v61Migration).toContain("137");
    expect(v61Migration).toContain("150");
    expect(v61Migration).toContain("competency_framework");
    expect(v61Migration).toContain("criticality_order");
    expect(psychAiIndex).toContain("gpt56-luna-medium-v6.2");
    expect(edge).toContain("gpt56-luna-medium-v6.2");
    expect(psychAiSemantic).toContain("classifyPrpScore");
    expect(psychAiGuardrails).toContain("evidence_integration");
    expect(certificate).toContain("Síntesis de competencias laborales");
    expect(certificate).toContain("drawHeader(ctx.page, ctx.font, ctx.bold, ctx.logo, ctx.payload.public_id, pageNumber, 1");
  });

  it("activa OpenAI GPT-5 mini como proveedor productivo psicolaboral", () => {
    expect(openAIProviderMigration).toContain("psych-ai-prompt-v4");
    expect(openAIProviderMigration).toContain("psych-ai-schema-v3");
    expect(openAIProviderMigration).toContain("'openai'");
    expect(openAIProviderMigration).toContain("'gpt-5-mini'");
    expect(openAIProviderMigration).toContain("notify pgrst, 'reload schema'");
  });

  it("reconstruye metodología V5 con informe integrado y PRP sin lenguaje automatizado", () => {
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
    expect(psychAiSemantic).toContain("psych-methodology-v6.2");
    expect(psychAiSemantic).toContain("prp-documentary-ranges-v6.1");
    expect(psychAiSemantic).not.toContain("prp_hard_lock_missing");
    expect(v52Migration).toContain("psych-ai-prompt-v5.2");
    expect(v52Migration).toContain("psych-ai-schema-v5.2");
    expect(v52Migration).toContain("analyst_input_tokens");
    expect(v52Migration).toContain("reviewer_executed");
    expect(v52Migration).toContain("p_metadata jsonb default '{}'::jsonb");
    expect(psychAiIndex).toContain("El objeto del informe es la compatibilidad");
    expect(psychAiIndex).toContain("reviewer_executed:");
    expect(psychAiIndex).toContain("needsReviewer(analystFlags)");
    expect(psychAiIndex).toContain("PRP usa rangos documentados");
    expect(psychAiGuardrails).toContain("delete cloned.prompt");
    expect(psychAiGuardrails).toContain("buildCompactPsychAIFacts");
    expect(psychAiGuardrails).toContain("backend_meta_language");
    expect(psychAiGuardrails).toContain("raw_technical_language");
    expect(audit).toContain("Evaluación de Personalidad IPIP-16");
    expect(audit).toContain("No es DISC ni Everything DiSC");
    expect(audit).toContain("Interpretación descriptiva habilitada");
  });

  it("versiona V5.3 con objetividad discriminativa, criticidad de cargo y GPT-5.6 Luna", () => {
    expect(v53Migration).toContain("psych-ai-prompt-v5.3");
    expect(v53Migration).toContain("psych-ai-schema-v5.3");
    expect(v53Migration).toContain("'gpt-5.6-luna'");
    expect(v53Migration).toContain("critical_competencies");
    expect(v53Migration).toContain("REQUIERE_PROFUNDIZACION");
    expect(v53Migration).toContain("prp_decision_weight");
    expect(psychAiGuardrails).toContain("buildCompatibilityFrame");
    expect(psychAiGuardrails).toContain("middle_results_default: \"NEUTRAL\"");
    expect(psychAiGuardrails).toContain("artificial_strength_removed");
    expect(psychAiIndex).toContain("Eres GPT-5.6 Luna");
    expect(psychAiIndex).not.toContain("Eres GPT-5 mini");
    expect(edge).toContain('PSYCH_AI_RUNTIME_VERSION = "gpt56-luna-medium-v6.2"');
  });

  it("cierra V6.2 sin cuarta categoria final y sin guiones bajos visibles en PDF", () => {
    expect(v62Migration).toContain("psych-ai-prompt-v6.2");
    expect(v62Migration).toContain("psych-ai-schema-v6.2");
    expect(v62Migration).toContain("jsonb_build_array('ADECUADO','ADECUADO_CON_OBSERVACIONES','NO_ADECUADO')");
    expect(v62Migration).not.toContain("jsonb_build_array('ADECUADO','ADECUADO_CON_OBSERVACIONES','REQUIERE_PROFUNDIZACION','NO_ADECUADO')");
    expect(psychAiIndex).toContain("No crees una categoría final de profundización");
    expect(psychAiIndex).not.toContain("recommendation: una de ADECUADO, ADECUADO_CON_OBSERVACIONES, REQUIERE_PROFUNDIZACION");
    expect(psychAiGuardrails).toContain('recommendation_labels: ["ADECUADO", "ADECUADO_CON_OBSERVACIONES", "NO_ADECUADO"]');
    expect(certificate).toContain("function humanizeCode");
    expect(certificate).toContain('replace(/_/g, " ")');
    expect(certificate).toContain('humanizeCode(ai.recommendation, "ADECUADO_CON_OBSERVACIONES")');
    expect(aiReviewDialog).not.toContain("REQUIERE_PROFUNDIZACION");
  });

  it("genera informe interno V5.4 humanizado sin lenguaje tecnico en el PDF", () => {
    expect(v54Migration).toContain("psych-ai-prompt-v5.4");
    expect(v54Migration).toContain("psych-ai-schema-v5.4");
    expect(v54Migration).toContain("'gpt-5.6-luna'");
    expect(certificate).toContain("sanitizeReportText");
    expect(certificate).toContain("defaultAIOutput");
    expect(certificate).toContain("drawBarChart");
    expect(certificate).toContain("drawRadar");
    expect(certificate).toContain("Seguridad, impulsividad y conclusión");
    expect(certificate).toContain("drawJustifiedParagraph");
    expect(certificate).toContain("payload.ai_interpretation?.display_output");
    expect(certificate).not.toContain("Informe V5.3 - Pagina");
    expect(certificate).not.toContain("Validacion profesional requerida");
    expect(certificate).not.toContain("Recomendación preliminar automatizada");
    expect(certificate).not.toContain("Confianza automatizada");
    expect(certificate).not.toContain("Este modelo interno no corresponde a DISC");
    expect(certificate).not.toContain("La interpretación es descriptiva y no incorpora baremos poblacionales locales ni evidencia de conducta observada");
  });
});
