#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const runFull = args.has("--full") || process.env.EEES_GUARDIAN_FULL === "1";
const findings = [];

function rel(...parts) {
  return path.join(...parts);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function listFiles(dir, predicate = () => true) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) {
    return [];
  }

  const result = [];
  const stack = [base];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
          continue;
        }
        stack.push(full);
      } else {
        const relative = path.relative(root, full);
        if (predicate(relative)) {
          result.push(relative);
        }
      }
    }
  }

  return result.sort((left, right) => left.localeCompare(right));
}

function add(level, ruleId, file, message) {
  findings.push({ level, ruleId, file, message });
}

function requireFile(relativePath, ruleId = "EEES-FILE") {
  if (!exists(relativePath)) {
    add("ERROR", ruleId, relativePath, "Archivo requerido no existe.");
  }
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return null;
  }

  const metadata = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    metadata[key] = value;
  }

  return metadata;
}

function validateMetadata() {
  const requiredKeys = [
    "document_id",
    "title",
    "version",
    "status",
    "language",
    "owner",
    "repository_scope",
    "baseline_date"
  ];

  const markdownFiles = listFiles("eees", (file) => file.endsWith(".md"));
  const ids = new Map();
  const fillerPattern = /\b(TBD|FIXME|RELLENO|pendiente por definir)\b/i;

  for (const file of markdownFiles) {
    const content = read(file);
    const metadata = parseFrontmatter(content);
    if (!metadata) {
      add("ERROR", "EEES-META", file, "Documento EEES sin metadata YAML.");
      continue;
    }

    for (const key of requiredKeys) {
      if (!metadata[key]) {
        add("ERROR", "EEES-META", file, `Falta metadata ${key}.`);
      }
    }

    if (metadata.language !== "es-CL") {
      add("ERROR", "EEES-META", file, "language debe ser es-CL.");
    }

    if (metadata.status !== "Activo") {
      add("ERROR", "EEES-META", file, "status debe ser Activo para documentos vigentes.");
    }

    if (metadata.document_id) {
      const current = ids.get(metadata.document_id) ?? [];
      current.push(file);
      ids.set(metadata.document_id, current);
    }

    if (file !== "eees/audits/EEES-CONSISTENCY-AUDIT.md" && fillerPattern.test(content)) {
      add("ERROR", "EEES-CONTENT", file, "Contiene marcador de relleno o trabajo abierto no permitido.");
    }
  }

  for (const [documentId, files] of ids.entries()) {
    if (files.length > 1) {
      add("ERROR", "EEES-META", files.join(", "), `document_id duplicado ${documentId}.`);
    }
  }
}

function validateRules() {
  const rulesPath = "eees/guardian/rules.json";
  requireFile(rulesPath, "EEES-RULES");

  if (!exists(rulesPath)) {
    return;
  }

  let rules;
  try {
    rules = JSON.parse(read(rulesPath));
  } catch (error) {
    add("ERROR", "EEES-RULES", rulesPath, `JSON invalido: ${error.message}`);
    return;
  }

  if (!Array.isArray(rules)) {
    add("ERROR", "EEES-RULES", rulesPath, "rules.json debe ser un array.");
    return;
  }

  const ids = new Map();
  const validPrefix = /^(ARCH|DB|SEC|FE|BE|MOD|QA|OBS|INT|DOC|TST|PERF|API|UX|DEP|CICD|DATA|REL|CONC|ERR|AI)-\d{3}$/;
  const allowedSourceRoots = [
    "eees/",
    "docs/CODEX_OBJECTIVE_LOOP_EEES_100_PERCENT.md",
    "docs/CODEX_OBJECTIVE_LOOP_ENTERPRISE_REPOSITORY_CLEANUP.md"
  ];

  for (const rule of rules) {
    for (const key of ["id", "title", "severity", "scope", "source_document", "automatable", "blocking"]) {
      if (!(key in rule)) {
        add("ERROR", "EEES-RULES", rulesPath, `Regla sin campo requerido ${key}.`);
      }
    }

    if (typeof rule.id === "string") {
      if (!validPrefix.test(rule.id)) {
        add("ERROR", "EEES-RULES", rulesPath, `ID de regla invalido: ${rule.id}.`);
      }
      const current = ids.get(rule.id) ?? 0;
      ids.set(rule.id, current + 1);
    }

    if (!["ERROR", "WARNING", "INFO"].includes(rule.severity)) {
      add("ERROR", "EEES-RULES", rulesPath, `severity invalida en ${rule.id}.`);
    }

    if (typeof rule.source_document === "string") {
      const sourceAllowed = allowedSourceRoots.some((allowed) => rule.source_document === allowed || rule.source_document.startsWith(allowed));
      if (!sourceAllowed) {
        add("ERROR", "EEES-RULES", rulesPath, `source_document fuera del alcance permitido en ${rule.id}: ${rule.source_document}.`);
      }
      if (!exists(rule.source_document)) {
        add("ERROR", "EEES-RULES", rulesPath, `source_document inexistente en ${rule.id}: ${rule.source_document}.`);
      }
    }
  }

  for (const [ruleId, count] of ids.entries()) {
    if (count > 1) {
      add("ERROR", "EEES-RULES", rulesPath, `Regla duplicada ${ruleId}.`);
    }
  }
}

function validateReferences() {
  const markdownFiles = listFiles("eees", (file) => file.endsWith(".md"));
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const file of markdownFiles) {
    const content = read(file);
    for (const match of content.matchAll(linkPattern)) {
      const target = match[1].trim();
      if (/^(https?:|mailto:|#)/.test(target)) {
        continue;
      }
      const cleanTarget = target.split("#")[0];
      if (!cleanTarget) {
        continue;
      }
      const resolved = path.normalize(path.join(path.dirname(file), cleanTarget));
      if (!exists(resolved)) {
        add("ERROR", "EEES-REF", file, `Referencia rota: ${target}.`);
      }
    }
  }
}

function validateP3Artifacts() {
  const requiredArtifacts = [
    "eees/audits/P3-CLOSURE-REPORT.md",
    "eees/audits/REGRESSION-COVERAGE-MATRIX.md",
    "eees/baselines/TESTING_BASELINE_v1.md",
    "vitest.config.ts",
    "tests/unit",
    "tests/contracts"
  ];

  for (const artifact of requiredArtifacts) {
    requireFile(artifact, "TST-005");
  }

  if (exists("package.json")) {
    const packageJson = JSON.parse(read("package.json"));
    const scripts = packageJson.scripts ?? {};
    for (const scriptName of ["test:unit", "test:contracts", "test:coverage"]) {
      if (!scripts[scriptName]) {
        add("ERROR", "TST-005", "package.json", `Falta script ${scriptName}.`);
      }
    }
  }
}

function validateP4Artifacts() {
  const requiredArtifacts = [
    "eees/audits/P4-CLOSURE-REPORT.md",
    "eees/baselines/PERFORMANCE_BASELINE_v1.md",
    "eees/baselines/OBSERVABILITY-BASELINE.md",
    "eees/certification/RELEASE-CHECKLIST.md",
    "eees/playbooks/PRODUCTION-ROLLBACK.md",
    "eees/playbooks/FAILED-MIGRATION.md",
    "scripts/audit-performance-baseline.mjs",
    "scripts/audit-p4-operational-readiness.mjs"
  ];

  for (const artifact of requiredArtifacts) {
    requireFile(artifact, "REL-003");
  }

  if (exists("package.json")) {
    const packageJson = JSON.parse(read("package.json"));
    const scripts = packageJson.scripts ?? {};
    for (const scriptName of ["audit:performance-baseline", "audit:p4-operational-readiness"]) {
      if (!scripts[scriptName]) {
        add("ERROR", "REL-003", "package.json", `Falta script ${scriptName}.`);
      }
    }
  }
}

function validateEnterprise100Artifacts() {
  const requiredArtifacts = [
    "eees/baselines/PRODUCTION_READINESS_BASELINE_v1.md",
    "eees/baselines/SRE_SLI_SLO_BASELINE_v1.md",
    "eees/baselines/CAPACITY_BASELINE_v1.md",
    "eees/audits/DISASTER-RECOVERY-READINESS.md",
    "eees/audits/FAILURE-MODE-MATRIX.md",
    "eees/audits/SECURITY-HARDENING-FINAL.md",
    "eees/audits/DATABASE-HARDENING-FINAL.md",
    "eees/audits/EEES-100-PERCENT-CLOSURE-REPORT.md",
    "eees/audits/FINAL-RESIDUAL-RISK-REGISTER.md",
    "eees/certification/ENTERPRISE-CERTIFICATION-FINAL.md",
    "scripts/audit-enterprise-100-readiness.mjs"
  ];

  for (const artifact of requiredArtifacts) {
    requireFile(artifact, "REL-004");
  }

  if (exists("package.json")) {
    const packageJson = JSON.parse(read("package.json"));
    const scripts = packageJson.scripts ?? {};
    if (!scripts["audit:enterprise-100-readiness"]) {
      add("ERROR", "REL-004", "package.json", "Falta script audit:enterprise-100-readiness.");
    }
  }

  if (exists(".github/workflows/audit-supabase-migrations.yml")) {
    const workflow = read(".github/workflows/audit-supabase-migrations.yml");
    for (const command of [
      "npm run guardian:full",
      "npm run test:unit",
      "npm run test:contracts",
      "npm run test:coverage",
      "npm run audit:enterprise-100-readiness",
      "git diff --check"
    ]) {
      if (!workflow.includes(command)) {
        add("ERROR", "REL-004", ".github/workflows/audit-supabase-migrations.yml", `CI no ejecuta ${command}.`);
      }
    }
  }
}

function validateRepositoryCleanupArtifacts() {
  const requiredArtifacts = [
    "eees/baselines/REPOSITORY-CLEANUP-BASELINE_v1.md",
    "eees/audits/REPOSITORY-CLEANUP-INVENTORY.md",
    "eees/audits/REPOSITORY-CLEANUP-CLOSURE-REPORT.md",
    "scripts/audit-repository-cleanup.mjs"
  ];

  for (const artifact of requiredArtifacts) {
    requireFile(artifact, "REL-005");
  }

  if (exists("package.json")) {
    const packageJson = JSON.parse(read("package.json"));
    if (!packageJson.scripts?.["audit:repository-cleanup"]) {
      add("ERROR", "REL-005", "package.json", "Falta script audit:repository-cleanup.");
    }
  }
}

function validateQueryKeyGovernance() {
  requireFile("src/shared/lib/queryKeys.ts", "FE-002");

  const sourceFiles = listFiles(
    "src",
    (file) => /\.(ts|tsx)$/.test(file) && file !== "src/shared/lib/queryKeys.ts"
  );
  const inlineQueryKeyPattern = /\bqueryKey\s*:\s*\[/g;
  const inlineInvalidationPattern = /\binvalidateQueries\s*\(\s*\{\s*queryKey\s*:\s*\[/g;
  const localFactoryPattern = /\b(?:const|let|var)\s+[A-Z0-9_]*QUERY_KEYS\b/g;

  for (const file of sourceFiles) {
    const content = read(file);
    if (inlineQueryKeyPattern.test(content) || inlineInvalidationPattern.test(content)) {
      add("ERROR", "FE-002", file, "Query key inline detectada; usar src/shared/lib/queryKeys.ts.");
    }
    if (localFactoryPattern.test(content)) {
      add("ERROR", "FE-002", file, "Factory local de query keys detectada; centralizar por dominio.");
    }
  }
}

function validatePureLogicTestCoverage() {
  const criticalCoverage = [
    {
      source: "src/modules/incentives/lib/incentiveRules.ts",
      tests: ["tests/unit/incentive-rules.test.ts"]
    },
    {
      source: "src/modules/incentives/lib/incentiveRegistrationHelpers.ts",
      tests: ["tests/unit/incentive-registration-helpers.test.ts"]
    },
    {
      source: "src/modules/incentives/services/incentivesApiMappers.ts",
      tests: ["tests/contracts/incentives-rpc-contracts.test.ts"]
    },
    {
      source: "src/modules/operaciones/lib/service-entry.ts",
      tests: [
        "tests/unit/operations-service-entry.test.ts",
        "tests/contracts/operations-service-entry-contract.test.ts"
      ]
    },
    {
      source: "src/modules/operaciones/lib/transformers.ts",
      tests: ["tests/unit/operations-transformers.test.ts"]
    },
    {
      source: "src/modules/recruitment/lib/candidateBukWorkerRules.ts",
      tests: ["tests/unit/recruitment-candidate-buk-worker-rules.test.ts"]
    },
    {
      source: "src/modules/recruitment/lib/candidateEmail.ts",
      tests: ["tests/unit/recruitment-email.test.ts"]
    },
    {
      source: "src/modules/recruitment/lib/candidateWorkerFileFormHelpers.ts",
      tests: ["tests/unit/recruitment-worker-file-form-helpers.test.ts"]
    },
    {
      source: "src/modules/recruitment/lib/whoCauseDrafts.ts",
      tests: ["tests/unit/recruitment-who-cause-drafts.test.ts"]
    },
    {
      source: "src/shared/lib/supabaseRpc.ts",
      tests: ["tests/unit/supabase-rpc-errors.test.ts"]
    },
    {
      source: "src/shared/lib/queryKeys.ts",
      tests: ["tests/unit/query-keys.test.ts"]
    }
  ];

  for (const entry of criticalCoverage) {
    if (!exists(entry.source)) {
      add("ERROR", "TST-006", entry.source, "Fuente critica registrada no existe.");
      continue;
    }

    for (const testPath of entry.tests) {
      if (!exists(testPath)) {
        add("ERROR", "TST-006", entry.source, `Falta test anti-regresion requerido: ${testPath}.`);
      }
    }
  }
}

function validateExceptionExpiry() {
  const exceptionFiles = listFiles(
    "eees",
    (file) => file.endsWith(".md") && /(^|\/)(exceptions?|suppressions?)(\/|$)/i.test(file)
  );
  const expiryPattern = /\b(expires_at|expiry|expires_on)\s*:\s*\d{4}-\d{2}-\d{2}\b/i;

  for (const file of exceptionFiles) {
    if (!expiryPattern.test(read(file))) {
      add("ERROR", "REL-002", file, "Toda excepcion nueva debe declarar expiracion ISO yyyy-mm-dd.");
    }
  }
}

function validateArchitectureContracts() {
  requireFile("src/app/router/AppRouter.tsx", "ARCH-001");
  requireFile("src/app/router/routeModules.ts", "ARCH-003");
  requireFile("docs/permissions-matrix.md", "MOD-001");

  if (!exists("src/app/router/AppRouter.tsx") || !exists("docs/permissions-matrix.md")) {
    return;
  }

  const appRouter = read("src/app/router/AppRouter.tsx");
  const permissions = read("docs/permissions-matrix.md");
  const moduleCodes = [...new Set([...appRouter.matchAll(/moduleCode="([^"]+)"/g)].map((match) => match[1]))];
  for (const moduleCode of moduleCodes) {
    if (!permissions.includes(`\`${moduleCode}\``)) {
      add("ERROR", "MOD-001", "docs/permissions-matrix.md", `Modulo routeado no documentado: ${moduleCode}.`);
    }
  }

  const routeModules = exists("src/app/router/routeModules.ts") ? read("src/app/router/routeModules.ts") : "";
  if (!routeModules.includes("preloadRouteModulesForPath")) {
    add("ERROR", "ARCH-003", "src/app/router/routeModules.ts", "Falta preloadRouteModulesForPath.");
  }
}

function validateSecurityPatterns() {
  const srcFiles = listFiles("src", (file) => /\.(ts|tsx)$/.test(file));
  for (const file of srcFiles) {
    const content = read(file);
    if (/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(content)) {
      add("ERROR", "SEC-001", file, "Referencia a service role en frontend.");
    }
    if (/visibleForEmails|allowedEmails|@busesjm\.com/.test(content)) {
      add("ERROR", "SEC-003", file, "Posible permiso por email hardcodeado.");
    }
    if (/src\/modules\/.+\.(tsx)$/.test(file) && /\bsupabase\s*\.\s*from\s*\(/.test(content)) {
      add("WARNING", "FE-001", file, "Componente TSX con acceso directo a Supabase; preferir servicio de dominio.");
    }
  }

  const errorHelper = exists("src/shared/lib/supabaseRpc.ts") ? read("src/shared/lib/supabaseRpc.ts") : "";
  if (!/STACK_TRACE_PATTERN/.test(errorHelper) || !/NETWORK_ERROR_MESSAGE/.test(errorHelper)) {
    add("ERROR", "ERR-001", "src/shared/lib/supabaseRpc.ts", "Falta sanitizacion central de errores Supabase.");
  }
}

function validateOversizedFiles() {
  const sourceFiles = listFiles("src", (file) => /\.(ts|tsx)$/.test(file));
  for (const file of sourceFiles) {
    const lines = read(file).split("\n").length;
    if (lines > 800) {
      add("WARNING", "PERF-001", file, `Archivo sobre 800 lineas: ${lines}.`);
    }
  }
}

function runCommand(name, command, args = []) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
    env: process.env
  });

  if (result.status === 0) {
    add("INFO", "EEES-GATE", name, "PASS");
    return true;
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  add("ERROR", "EEES-GATE", name, output || `Comando fallo con status ${result.status}.`);
  return false;
}

function runGates() {
  runCommand("test:unit", "npm", ["run", "test:unit"]);
  runCommand("test:contracts", "npm", ["run", "test:contracts"]);
  runCommand("audit:enterprise-docs", "npm", ["run", "audit:enterprise-docs"]);
  runCommand("audit:p4-operational-readiness", "npm", ["run", "audit:p4-operational-readiness"]);
  runCommand("audit:enterprise-100-readiness", "npm", ["run", "audit:enterprise-100-readiness"]);
  runCommand("audit:repository-cleanup", "npm", ["run", "audit:repository-cleanup"]);
  runCommand("audit:route-role-smoke", "npm", ["run", "audit:route-role-smoke"]);
  runCommand("audit:frontend-auth-smoke-matrix", "npm", ["run", "audit:frontend-auth-smoke-matrix"]);
  runCommand("audit:onboarding-legacy-guards", "npm", ["run", "audit:onboarding-legacy-guards"]);
  runCommand("audit:migrations", "npm", ["run", "audit:migrations"]);
  runCommand("audit:supabase-security", "npm", ["run", "audit:supabase-security"]);
  runCommand("build:frontend-check", "npm", ["run", "build:frontend-check"]);
  runCommand("audit:performance-baseline", "npm", ["run", "audit:performance-baseline"]);
  runCommand("git diff --check", "git", ["diff", "--check"]);

  if (runFull) {
    runCommand("test:coverage", "npm", ["run", "test:coverage"]);
    runCommand("smoke:frontend-routes", "npm", ["run", "smoke:frontend-routes"]);
    runCommand("check:edge:sync-buk-candidates", "npm", ["run", "check:edge:sync-buk-candidates"]);
  }
}

function writeConsistencyAudit() {
  const errors = findings.filter((finding) => finding.level === "ERROR");
  const warnings = findings.filter((finding) => finding.level === "WARNING");
  const infos = findings.filter((finding) => finding.level === "INFO");
  const status = errors.length === 0 ? "PASS" : "FAIL";
  const body = `---
document_id: EEES-AUDIT-CONSISTENCY
title: EEES Consistency Audit
version: 1.0.0
status: Activo
language: es-CL
owner: QA
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# EEES Consistency Audit

## Estado

${status}

## Resumen

- Errores: ${errors.length}
- Warnings: ${warnings.length}
- Info: ${infos.length}

## Errores

${errors.length ? errors.map((item) => `- ${item.ruleId} · \`${item.file}\` · ${item.message}`).join("\n") : "- Sin errores bloqueantes."}

## Warnings

${warnings.length ? warnings.map((item) => `- ${item.ruleId} · \`${item.file}\` · ${item.message}`).join("\n") : "- Sin warnings."}

## Gates informativos

${infos.length ? infos.map((item) => `- ${item.file}: ${item.message}`).join("\n") : "- Sin gates informados."}
`;

  fs.writeFileSync(path.join(root, "eees/audits/EEES-CONSISTENCY-AUDIT.md"), body, "utf8");
}

function printFindings() {
  for (const level of ["ERROR", "WARNING", "INFO"]) {
    const items = findings.filter((finding) => finding.level === level);
    if (items.length === 0) {
      continue;
    }
    console.log(`\n${level}`);
    for (const item of items) {
      console.log(`- ${item.ruleId} ${item.file}: ${item.message}`);
    }
  }
}

for (const file of [
  "eees/README.md",
  "eees/INDEX.md",
  "eees/CHANGELOG.md",
  "eees/guardian/rules.json",
  "eees/guardian/suppressions.json",
  "eees/guardian/REGRESSION-POLICY.md",
  "eees/codex/BOOT_SEQUENCE.md",
  "eees/audits/FINAL-IMPLEMENTATION-REPORT.md"
]) {
  requireFile(file);
}

validateMetadata();
validateRules();
validateReferences();
validateP3Artifacts();
validateP4Artifacts();
validateEnterprise100Artifacts();
validateRepositoryCleanupArtifacts();
validateQueryKeyGovernance();
validatePureLogicTestCoverage();
validateExceptionExpiry();
validateArchitectureContracts();
validateSecurityPatterns();
validateOversizedFiles();
runGates();
writeConsistencyAudit();
printFindings();

const errorCount = findings.filter((finding) => finding.level === "ERROR").length;
const warningCount = findings.filter((finding) => finding.level === "WARNING").length;

console.log(`\nGuardian summary: ${errorCount} error(s), ${warningCount} warning(s).`);

if (errorCount > 0) {
  process.exit(1);
}
