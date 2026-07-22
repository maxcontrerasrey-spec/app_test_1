import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourcePath = "supabase/functions/sync-buk-candidates/index.ts";
const source = fs.readFileSync(path.join(rootDir, sourcePath), "utf8");
const migrationsDir = path.join(rootDir, "supabase/migrations");
const migrationSources = fs
  .readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .map((fileName) => fs.readFileSync(path.join(migrationsDir, fileName), "utf8"))
  .join("\n");

const checks = [];

function addCheck(ok, message) {
  checks.push({ ok, message });
}

addCheck(
  /function\s+resolveBukEmployeeStatus\s*\(/.test(source),
  "sync-buk-candidates normaliza estados BUK desde campos alternativos"
);
addCheck(
  /function\s+isInactiveBukEmployee\s*\([\s\S]*?matchesBukEmployeeDocument\(employee,\s*payload\)/.test(source),
  "fichas BUK inactivas se clasifican por documento exacto"
);
addCheck(
  /function\s+isInactiveBukEmployee\s*\([\s\S]*?\)\s*;\s*\n\}/.test(source) &&
    !/function\s+isInactiveBukEmployee\s*\([\s\S]*?hasCompatibleBukEmployeeContact\(employee,\s*payload\)[\s\S]*?\n\}/.test(source),
  "la rama inactiva no depende de igualdad de email historico"
);
addCheck(
  /isRepairableActiveBukEmployee\(employee,\s*payload\)/.test(source) &&
    /!hasBukCurrentJob\(employee\)/.test(source),
  "fichas activas ERP incompletas se reparan antes de cancelar por duplicado"
);
addCheck(
  /resolution:\s*"reused_incomplete_existing"/.test(source) &&
    /resolution:\s*"cloned_existing_inactive"/.test(source),
  "la resolucion inactiva conserva caminos de reutilizacion y clonacion"
);
addCheck(
  /buildBukEmployeeResolutionAudit\s*\(/.test(source) &&
    /resolutionAudit/.test(source) &&
    /BukEmployeeResolutionError/.test(source) &&
    /employeeResolutionAudit/.test(source),
  "la resolucion BUK deja auditoria estructurada en success y error"
);
addCheck(
  /finalizeExistingActiveEmployeeJob/.test(source) &&
    /cancel_request_existing_active_buk_employee/.test(source),
  "solo el duplicado activo confirmado mantiene la cancelacion ERP"
);
addCheck(
  /staleProcessingRecovery/.test(migrationSources) &&
    /started_at\s*<\s*stale_cutoff/.test(migrationSources) &&
    /source',\s*'claim_buk_sync_jobs'/.test(migrationSources) &&
    /source',\s*'enqueue_buk_generation'/.test(migrationSources),
  "jobs BUK processing obsoletos se recuperan al reclamar o reencolar"
);
addCheck(
  /6170400010:0001/.test(migrationSources) &&
    /CODELCO DRT/.test(migrationSources) &&
    /Consorcio nuevo norte SPA/.test(migrationSources) &&
    /resolve_known_company_name/.test(migrationSources) &&
    /internal_mobility_requests/.test(migrationSources),
  "CODELCO DRT queda mapeado a Consorcio nuevo norte en contratos BUK y movilidad interna"
);
addCheck(
  /tmp_authoritative_buk_mapping_companies/.test(migrationSources) &&
    /employees_active_current/.test(migrationSources) &&
    /extract_buk_company_id/.test(migrationSources) &&
    /rank\(\)\s+over[\s\S]*partition\s+by[\s\S]*mapping_id/.test(migrationSources) &&
    /companies_with_same_sample_count\s*=\s*1/.test(migrationSources) &&
    /update\s+public\.buk_contract_mappings/.test(migrationSources) &&
    /update\s+public\.internal_mobility_requests/.test(migrationSources) &&
    /update\s+public\.internal_mobility_request_snapshots/.test(migrationSources),
  "empresas de contratos BUK se reconcilian contra BUK vivo de forma general y sin empates"
);
addCheck(
  /create\s+or\s+replace\s+function\s+public\.resolve_known_company_name[\s\S]*from\s+public\.buk_contract_mappings/.test(migrationSources) &&
    /language\s+sql\s+stable/.test(migrationSources),
  "resolve_known_company_name prioriza el mapping BUK exacto antes del fallback por sufijo"
);

const failedChecks = checks.filter((check) => !check.ok);

if (failedChecks.length > 0) {
  console.error("BUK sync guard audit failed:");
  for (const check of failedChecks) {
    console.error(`- ${check.message}`);
  }
  process.exit(1);
}

console.log("BUK sync guard audit passed:");
for (const check of checks) {
  console.log(`- ${check.message}`);
}
