#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const requiredFiles = [
  "docs/CODEX_OBJECTIVE_LOOP_CORE_DATA_INTEGRITY.md",
  "eees/audits/CORE-TRANSACTION-MAP.md",
  "eees/audits/DOMAIN-INVARIANT-MATRIX.md",
  "eees/audits/CORE-DATA-INTEGRITY-FINDINGS.md",
  "eees/audits/CORE-DATA-INTEGRITY-CLOSURE-REPORT.md",
  "eees/certification/CORE-DATA-INTEGRITY-CERTIFICATION.md",
  "tests/integrity/core-data-integrity.test.ts",
  "tests/concurrency/core-data-concurrency.test.ts",
  "tests/idempotency/core-data-idempotency.test.ts",
  "supabase/migrations/20260722183930_core_data_integrity_hardening.sql",
  "supabase/migrations/20260722184523_recover_stale_buk_sync_processing_jobs.sql",
  "supabase/migrations/20260722184756_recover_stale_candidate_document_cleanup_jobs.sql",
  "supabase/migrations/20260722184849_add_accreditation_document_upload_jobs.sql"
];

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Falta ${file}`);
}

if (failures.length === 0) {
  const migration = read("supabase/migrations/20260722183930_core_data_integrity_hardening.sql");
  const packageJson = JSON.parse(read("package.json"));
  const workflow = read(".github/workflows/audit-supabase-migrations.yml");
  const bukDocuments = read("supabase/functions/_shared/bukDocuments.ts");
  const bukSync = read("supabase/functions/sync-buk-candidates/index.ts");
  const purge = read("supabase/functions/purge-candidate-documents/index.ts");
  const accreditationUpload = read("supabase/functions/upload-buk-accreditation-document/index.ts");
  const checks = [
    [migration.includes("enable row level security"), "Falta RLS para tabla audit-only"],
    [migration.includes("hiring_requests_requester_idempotency_uidx"), "Falta idempotencia hiring"],
    [migration.includes("hr_incentive_requests_creator_idempotency_uidx"), "Falta idempotencia incentivos"],
    [migration.includes("assign_hr_worker_roster_v2"), "Falta guard de concurrencia roster"],
    [migration.includes("pg_advisory_xact_lock"), "Falta serializacion transaccional"],
    [migration.includes("on conflict (snapshot_date, buk_employee_id) do nothing"), "Snapshot BUK no es inmutable"],
    [bukDocuments.includes("BUK_DOCUMENT_UPLOAD_TIMEOUT_MS"), "Upload BUK sin timeout"],
    [!bukDocuments.includes("[400, 409, 415, 422]"), "Upload BUK repite conflictos ambiguos"],
    [bukSync.includes("jobResultSnapshot.documents = uploadedDocuments"), "Sync BUK sin checkpoint por documento"],
    [purge.includes('phase: "purge_intent_recorded"'), "Purga documental sin intent durable"],
    [accreditationUpload.includes('status: "buk_uploaded"'), "Acreditacion sin checkpoint BUK"],
    [packageJson.scripts?.["test:integrity"], "Falta script test:integrity"],
    [packageJson.scripts?.["test:concurrency"], "Falta script test:concurrency"],
    [packageJson.scripts?.["test:idempotency"], "Falta script test:idempotency"],
    [workflow.includes("npm run audit:core-data-integrity"), "CI no ejecuta auditor CORE"],
    [workflow.includes("npm run test:integrity"), "CI no ejecuta integridad"],
    [workflow.includes("npm run test:concurrency"), "CI no ejecuta concurrencia"],
    [workflow.includes("npm run test:idempotency"), "CI no ejecuta idempotencia"]
  ];
  for (const [passes, message] of checks) if (!passes) failures.push(message);
}

if (failures.length) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exit(1);
}

console.log("CORE data integrity audit: PASS");
