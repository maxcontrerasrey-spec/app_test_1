import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const checks = [];

function addCheck(ok, message) {
  checks.push({ ok, message });
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function requireContent(file, patterns) {
  addCheck(exists(file), `${file} existe`);
  if (!exists(file)) {
    return;
  }

  const content = read(file);
  for (const [pattern, message] of patterns) {
    addCheck(pattern.test(content), `${file}: ${message}`);
  }
}

const migrations = fs
  .readdirSync(path.join(repoRoot, "supabase/migrations"))
  .filter((fileName) => fileName.endsWith(".sql"))
  .map((fileName) => read(path.join("supabase/migrations", fileName)))
  .join("\n");

const syncBukCandidates = read("supabase/functions/sync-buk-candidates/index.ts");
const purgeCandidateDocuments = read("supabase/functions/purge-candidate-documents/index.ts");
const workflow = read(".github/workflows/audit-supabase-migrations.yml");

requireContent("eees/audits/P4-CLOSURE-REPORT.md", [
  [/COMPLETE\./, "cierre P4 declarado"],
  [/Performance baseline: PASS/, "baseline performance validado"],
  [/Guardian Full: PASS/, "Guardian full registrado"]
]);
requireContent("eees/baselines/PERFORMANCE_BASELINE_v1.md", [
  [/dist total/i, "incluye dist total medido"],
  [/JS total/i, "incluye JS total medido"],
  [/<!-- EEES_PERFORMANCE_BASELINE_JSON -->/, "incluye bloque machine-readable"]
]);
requireContent("eees/certification/RELEASE-CHECKLIST.md", [
  [/npm run guardian:full/, "exige Guardian full"],
  [/npm run test:unit/, "exige unit tests"],
  [/npm run test:contracts/, "exige contract tests"],
  [/npm run test:coverage/, "exige coverage"],
  [/Rollback/, "exige rollback"]
]);
requireContent("eees/playbooks/PRODUCTION-ROLLBACK.md", [
  [/Frontend/, "cubre rollback frontend"],
  [/SQL aplicado/, "cubre forward-fix SQL"],
  [/Edge Function/, "cubre rollback de Edge Functions"],
  [/Validacion/, "cubre validacion posterior"]
]);
requireContent("eees/playbooks/FAILED-MIGRATION.md", [
  [/No editar migraciones historicas/i, "bloquea mutacion de historia"],
  [/schema_migrations/, "cubre historial remoto"],
  [/notify pgrst/i, "cubre reload de PostgREST"]
]);
requireContent("eees/books/OBSERVABILITY.md", [
  [/OBS-005/, "define correlation id operacional"],
  [/OBS-006/, "define alertas accionables"],
  [/OBS-007/, "define baseline performance"]
]);

addCheck(
  /claim_candidate_document_cleanup_jobs[\s\S]*FOR UPDATE SKIP LOCKED/i.test(migrations),
  "cleanup documental reclama jobs atomicamente con FOR UPDATE SKIP LOCKED"
);
addCheck(
  /claim_buk_sync_jobs[\s\S]*FOR UPDATE SKIP LOCKED/i.test(migrations),
  "sync BUK reclama jobs atomicamente con FOR UPDATE SKIP LOCKED"
);
addCheck(/staleProcessingRecovery/.test(migrations), "jobs BUK processing obsoletos tienen recuperacion trazada");
addCheck(/alreadyUploadedDocumentIds/.test(syncBukCandidates), "sync BUK no resube documentos ya exitosos en retry");
addCheck(/isInternalInvocation/.test(syncBukCandidates) && /authorizeRequestedJobs/.test(syncBukCandidates), "sync BUK separa invocacion interna e interactiva autorizada");
addCheck(/isInternalInvocation/.test(purgeCandidateDocuments) && /authorizeInteractiveCleanup/.test(purgeCandidateDocuments), "purga documental separa barrido interno e invocacion interactiva autorizada");
addCheck(/looksLikeHtml/.test(syncBukCandidates), "sync BUK sanitiza errores HTML de proveedor externo");
addCheck(/run: npm run guardian/.test(workflow), "workflow enterprise ejecuta Guardian");
addCheck(/run: npm run smoke:frontend-routes/.test(workflow), "workflow enterprise ejecuta smoke de rutas");
addCheck(/run: npm run audit:migrations/.test(workflow), "workflow enterprise ejecuta auditoria de migraciones");
addCheck(/run: npm run audit:supabase-security/.test(workflow), "workflow enterprise ejecuta auditoria Supabase");
addCheck(exists("scripts/audit-performance-baseline.mjs"), "auditor performance P4 existe");
addCheck(exists("scripts/audit-p4-operational-readiness.mjs"), "auditor readiness P4 existe");

const failedChecks = checks.filter((check) => !check.ok);
if (failedChecks.length > 0) {
  console.error("P4 operational readiness audit failed:");
  for (const check of failedChecks) {
    console.error(`- ${check.message}`);
  }
  process.exit(1);
}

console.log("P4 operational readiness audit passed:");
for (const check of checks) {
  console.log(`- ${check.message}`);
}
