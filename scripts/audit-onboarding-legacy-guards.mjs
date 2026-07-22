import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const checks = [];
const LEGACY_FUNCTIONS = [
  "start_employee_onboarding",
  "get_onboarding_dashboard",
  "get_employee_onboarding_detail",
  "evaluate_onboarding_course"
];
const LEGACY_TABLES = [
  "onboarding_courses_catalog",
  "onboarding_processes",
  "onboarding_employee_courses"
];

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function addCheck(ok, message) {
  checks.push({ ok, message });
}

function assertFile(relativePath) {
  addCheck(fileExists(relativePath), `${relativePath} existe`);
  return fileExists(relativePath) ? readFile(relativePath) : "";
}

const router = assertFile("src/app/router/AppRouter.tsx");
const layout = assertFile("src/modules/operational_onboarding/pages/OnboardingModuleLayout.tsx");
const permissions = assertFile("docs/permissions-matrix.md");
const moduleMap = assertFile("docs/module-map.md");
const databaseModel = assertFile("docs/database-model.md");
const securityReview = assertFile("docs/security-review.md");
const alignMigration = assertFile(
  "supabase/migrations/20260628130000_align_operational_onboarding_legacy_permissions.sql"
);
const directAccessMigration = assertFile(
  "supabase/migrations/20260709102000_harden_operational_onboarding_direct_table_access.sql"
);

addCheck(
  /path="\/alta-operacional\/:tab\?"/.test(router) &&
    /moduleCode="alta_operacional_personal"/.test(router),
  "ruta viva /alta-operacional esta protegida por alta_operacional_personal"
);
addCheck(
  layout.includes('accessibleModules.includes("alta_operacional_personal")') &&
    !layout.includes('accessibleModules.includes("reclutamiento")'),
  "layout vivo de alta operacional no usa reclutamiento como modulo"
);
addCheck(
  permissions.includes("Sobrevive SQL legacy de onboarding") &&
    permissions.includes("alta_operacional_personal"),
  "permissions-matrix documenta deuda legacy contenida"
);
addCheck(
  moduleMap.includes("Riesgo: coexistencia de SQL legacy de onboarding"),
  "module-map documenta riesgo legacy de onboarding"
);
addCheck(
  databaseModel.includes("artefactos legacy de onboarding"),
  "database-model documenta artefactos legacy de onboarding"
);
addCheck(
  securityReview.includes("deuda legacy de onboarding") &&
    securityReview.includes("alta_operacional_personal"),
  "security-review documenta condicion de salida de onboarding legacy"
);

for (const functionName of LEGACY_FUNCTIONS) {
  const functionPattern = new RegExp(`create or replace function public\\.${functionName}\\b`);
  const functionIndex = alignMigration.search(functionPattern);
  const helperIndex = alignMigration.indexOf("public.user_can_access_operational_onboarding", functionIndex);

  addCheck(functionIndex >= 0, `migracion de alineacion reemplaza ${functionName}`);
  addCheck(
    functionIndex >= 0 && helperIndex > functionIndex,
    `${functionName} usa helper operacional y no modulo reclutamiento`
  );
}

addCheck(
  !/user_can_access_module\s*\([^;]+['"]reclutamiento['"]/.test(alignMigration),
  "migracion de alineacion no reutiliza reclutamiento como modulo"
);
addCheck(
  directAccessMigration.includes("user_can_access_operational_onboarding") &&
    directAccessMigration.includes("user_can_manage_operational_onboarding"),
  "hardening posterior conserva helpers canonicos de onboarding operacional"
);

for (const tableName of LEGACY_TABLES) {
  addCheck(
    directAccessMigration.includes(`'${tableName}'`),
    `hardening posterior revoca acceso directo legacy a ${tableName}`
  );
}

const failedChecks = checks.filter((check) => !check.ok);

if (failedChecks.length > 0) {
  console.error("Onboarding legacy guard audit failed:");
  for (const check of failedChecks) {
    console.error(`- ${check.message}`);
  }
  process.exit(1);
}

console.log("Onboarding legacy guard audit passed:");
for (const check of checks) {
  console.log(`- ${check.message}`);
}
