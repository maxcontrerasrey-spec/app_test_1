import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const checks = [];

function fullPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(fullPath(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(fullPath(relativePath), "utf8");
}

function addCheck(ok, message) {
  checks.push({ ok, message });
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

function listFiles(dir, predicate = () => true) {
  const base = fullPath(dir);
  if (!fs.existsSync(base)) {
    return [];
  }

  const files = [];
  const stack = [base];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const item = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", ".git", "dist", "coverage"].includes(entry.name)) {
          stack.push(item);
        }
      } else {
        const relative = path.relative(repoRoot, item);
        if (predicate(relative)) {
          files.push(relative);
        }
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

requireContent("eees/baselines/PRODUCTION_READINESS_BASELINE_v1.md", [
  [/health\/readiness/i, "declara health/readiness"],
  [/Environment contract/i, "declara contrato de entorno"],
  [/Dependencias externas/i, "clasifica dependencias externas"],
  [/VITE_SUPABASE_URL/, "incluye Supabase URL publica"],
  [/VITE_SUPABASE_ANON_KEY/, "incluye Supabase anon key"]
]);

requireContent("eees/baselines/SRE_SLI_SLO_BASELINE_v1.md", [
  [/NO MEDIDO/i, "usa NO MEDIDO para senales sin fuente ejecutable"],
  [/Disponibilidad/i, "cubre disponibilidad"],
  [/Error rate/i, "cubre tasa de error"],
  [/Latencia/i, "cubre latencia"],
  [/BUK/i, "cubre integracion BUK"]
]);

requireContent("eees/baselines/CAPACITY_BASELINE_v1.md", [
  [/Archivos TS\/TSX/i, "incluye conteo frontend"],
  [/Migraciones SQL/i, "incluye conteo de migraciones"],
  [/Edge Functions/i, "incluye edge functions"],
  [/dist total/i, "incluye tamano de bundle"]
]);

requireContent("eees/audits/DISASTER-RECOVERY-READINESS.md", [
  [/PostgreSQL/i, "cubre PostgreSQL"],
  [/Storage/i, "cubre Storage"],
  [/Migraciones/i, "cubre migraciones"],
  [/No se ejecuto restore destructivo/i, "clasifica restore destructivo como externo"]
]);

requireContent("eees/audits/FAILURE-MODE-MATRIX.md", [
  [/Supabase/i, "cubre Supabase"],
  [/BUK/i, "cubre BUK"],
  [/CI\/CD/i, "cubre CI/CD"],
  [/Playbook/i, "declara playbooks"]
]);

requireContent("eees/audits/SECURITY-HARDENING-FINAL.md", [
  [/RLS/i, "cubre RLS"],
  [/service role/i, "cubre service role"],
  [/Storage policies/i, "cubre Storage policies"],
  [/audit:supabase-security/i, "declara auditor de seguridad"]
]);

requireContent("eees/audits/DATABASE-HARDENING-FINAL.md", [
  [/forward-only/i, "cubre migraciones forward-only"],
  [/constraints/i, "cubre constraints"],
  [/índices|indices/i, "cubre indices"],
  [/audit:migrations/i, "declara auditor de migraciones"]
]);

requireContent("eees/audits/EEES-100-PERCENT-CLOSURE-REPORT.md", [
  [/CERTIFIED WITH EXTERNAL DEPENDENCIES/i, "declara resultado de certificacion"],
  [/Guardian Full: PASS/i, "registra Guardian full"],
  [/Dependencias externas restantes/i, "clasifica dependencias externas"],
  [/0 blockers internos/i, "declara blockers internos en cero"]
]);

requireContent("eees/certification/ENTERPRISE-CERTIFICATION-FINAL.md", [
  [/Enterprise Certification/i, "incluye certificacion final"],
  [/CERTIFIED WITH EXTERNAL DEPENDENCIES/i, "resultado final permitido"],
  [/Architecture/i, "cubre dominio arquitectura"],
  [/Disaster Recovery/i, "cubre dominio DR"]
]);

requireContent("eees/audits/FINAL-RESIDUAL-RISK-REGISTER.md", [
  [/Dependencia externa/i, "clasifica riesgos externos"],
  [/Sin blockers internos/i, "declara ausencia de blockers internos"],
  [/Owner/i, "declara owner"]
]);

requireContent("eees/certification/RELEASE-CHECKLIST.md", [
  [/audit:enterprise-100-readiness/, "exige auditor enterprise 100"],
  [/Disaster Recovery/i, "exige DR"],
  [/Failure Mode Matrix/i, "exige failure modes"],
  [/Capacity baseline/i, "exige capacity baseline"]
]);

requireContent("eees/INDEX.md", [
  [/PRODUCTION_READINESS_BASELINE_v1.md/, "indexa production readiness"],
  [/SRE_SLI_SLO_BASELINE_v1.md/, "indexa SRE baseline"],
  [/CAPACITY_BASELINE_v1.md/, "indexa capacity baseline"],
  [/EEES-100-PERCENT-CLOSURE-REPORT.md/, "indexa cierre 100"],
  [/ENTERPRISE-CERTIFICATION-FINAL.md/, "indexa certificacion final"]
]);

const packageJson = JSON.parse(read("package.json"));
addCheck(Boolean(packageJson.scripts?.["audit:enterprise-100-readiness"]), "package.json expone audit:enterprise-100-readiness");

const guardian = read("scripts/audit-eees-guardian.mjs");
addCheck(/validateEnterprise100Artifacts/.test(guardian), "Guardian valida artefactos EEES 100");
addCheck(/audit:enterprise-100-readiness/.test(guardian), "Guardian ejecuta auditor enterprise 100");

const workflow = read(".github/workflows/audit-supabase-migrations.yml");
addCheck(/npm run guardian:full/.test(workflow), "CI ejecuta Guardian full");
addCheck(/npm run test:unit/.test(workflow), "CI ejecuta unit tests");
addCheck(/npm run test:contracts/.test(workflow), "CI ejecuta contract tests");
addCheck(/npm run test:coverage/.test(workflow), "CI ejecuta coverage");
addCheck(/npm run audit:enterprise-100-readiness/.test(workflow), "CI ejecuta auditor enterprise 100");

const eeesMarkdown = listFiles("eees", (file) => file.endsWith(".md"));
const prohibited = /\b(TBD|FIXME|pendiente por definir)\b/i;
for (const file of eeesMarkdown) {
  if (file === "eees/audits/EEES-CONSISTENCY-AUDIT.md") {
    continue;
  }
  addCheck(!prohibited.test(read(file)), `${file} no contiene placeholders bloqueantes`);
}

const failedChecks = checks.filter((check) => !check.ok);
if (failedChecks.length > 0) {
  console.error("Enterprise 100 readiness audit failed:");
  for (const check of failedChecks) {
    console.error(`- ${check.message}`);
  }
  process.exit(1);
}

console.log("Enterprise 100 readiness audit passed:");
for (const check of checks) {
  console.log(`- ${check.message}`);
}
