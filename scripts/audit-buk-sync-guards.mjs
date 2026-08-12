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
  /shoeSize:\s*"Numero Calzado"/.test(source) &&
    /pantsSize:\s*"Talla Pantalón"/.test(source) &&
    /shirtSize:\s*"Talla Polera"/.test(source) &&
    /custom_attributes:\s*buildBukUniformSizeAttributes\(payload\)/.test(source),
  "creacion y clonacion BUK reciben las tres tallas como atributos personalizados"
);
addCheck(
  /async function syncBukEmployeeUniformSizes[\s\S]*?employeeBefore = await fetchBukEmployeeById[\s\S]*?hasExpectedBukAttributes[\s\S]*?changed:\s*false[\s\S]*?method:\s*"PATCH"[\s\S]*?hasPreservedBukAttributes[\s\S]*?verifiedAt/.test(source) &&
    /const uniformSizes = await syncBukEmployeeUniformSizes\(payload, employeeId\)/.test(source) &&
    source.indexOf("const uniformSizes = await syncBukEmployeeUniformSizes(payload, employeeId)") <
      source.indexOf("const setupResult = await ensureBukEmployeeSetup", source.indexOf("const uniformSizes = await syncBukEmployeeUniformSizes(payload, employeeId)")),
  "el job hace GET previo, evita PATCH redundante y verifica tallas y atributos ajenos antes de finalizar"
);
addCheck(
  /staleProcessingRecovery/.test(migrationSources) &&
    /started_at\s*<\s*stale_cutoff/.test(migrationSources) &&
    /source',\s*'claim_buk_sync_jobs'/.test(migrationSources) &&
    /source',\s*'enqueue_buk_generation'/.test(migrationSources),
  "jobs BUK processing obsoletos se recuperan al reclamar o reencolar"
);
addCheck(
  /create table if not exists private\.buk_employee_code_reservations/.test(migrationSources) &&
    /uq_buk_employee_code_reservations_active_code/.test(migrationSources) &&
    /pg_advisory_xact_lock/.test(migrationSources) &&
    /'buk-sheet:' \|\| normalized_identity/.test(migrationSources),
  "codigos F1/F2 se reservan de forma unica y serializada por documento"
);
addCheck(
  /trg_buk_sync_jobs_reserve_employee_code/.test(migrationSources) &&
    /reserved_employee_code/.test(migrationSources) &&
    /revoke all on function public\.resolve_candidate_worker_employee_code\(uuid\)[\s\S]*?from public, anon, authenticated, service_role/.test(migrationSources),
  "todo job congela una reserva autoritativa y el resolver interno no queda expuesto"
);
addCheck(
  /reconcileBukEmployeeCodeBeforeWrite/.test(source) &&
    /reconcile_buk_employee_code_reservation/.test(source) &&
    /verifyAndConfirmBukEmployeeCode/.test(source) &&
    /confirm_buk_employee_code_reservation/.test(source) &&
    source.indexOf("reconcileBukEmployeeCodeBeforeWrite") <
      source.indexOf("resolveBukEmployeeForSync(payload, locations)") &&
    source.indexOf("verifyAndConfirmBukEmployeeCode") <
      source.indexOf("syncBukEmployeeUniformSizes(payload, employeeId)"),
  "la Edge reconcilia BUK antes del POST y confirma code_sheet antes de efectos posteriores"
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
addCheck(
  /A BUK contract number[\s\S]*Force live catalog resolution/.test(source) &&
    /areaCode && \/\^\\d\+:\\d\+\$\/\.test\(areaCode\)/.test(source),
  "los códigos visibles de contrato se resuelven contra el cost center operativo BUK"
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
