import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const manifestPath = "tests/smoke/frontend-authenticated.scenarios.json";
const workflowPath = ".github/workflows/audit-supabase-migrations.yml";
const docsPath = "docs/smoke-tests.md";
const packagePath = "package.json";
const checks = [];
const knownRoles = new Set([
  "admin",
  "aprobador_folios",
  "reclutamiento",
  "control_contratos",
  "operaciones",
  "gerencia",
  "director_eje",
  "director_op",
  "gerente_general",
  "operaciones_l_1",
  "operaciones_l_2",
  "administrativo",
  "jefe_administrativo",
  "certificaciones",
  "instructor"
]);
const minimumRoleCoverage = [
  "admin",
  "reclutamiento",
  "control_contratos",
  "operaciones",
  "gerencia",
  "director_eje",
  "director_op",
  "gerente_general",
  "operaciones_l_1",
  "operaciones_l_2",
  "administrativo",
  "jefe_administrativo",
  "certificaciones",
  "instructor"
];

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function addCheck(ok, message) {
  checks.push({ ok, message });
}

function readString(record, key) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizePath(value) {
  return value.startsWith("/") && !value.includes("://");
}

function parseManifest() {
  addCheck(fs.existsSync(path.join(rootDir, manifestPath)), `${manifestPath} existe`);

  if (!fs.existsSync(path.join(rootDir, manifestPath))) {
    return [];
  }

  const manifest = JSON.parse(readFile(manifestPath));
  addCheck(manifest.version === 1, `${manifestPath} declara version 1`);
  addCheck(Array.isArray(manifest.scenarios), `${manifestPath} declara scenarios[]`);

  if (!Array.isArray(manifest.scenarios)) {
    return [];
  }

  const scenarioIds = new Set();
  return manifest.scenarios.map((scenario, index) => {
    const id = readString(scenario, "id");
    const role = readString(scenario, "role");
    const emailEnv = readString(scenario, "emailEnv");
    const passwordEnv = readString(scenario, "passwordEnv");
    const targetPath = readString(scenario, "targetPath");
    const expectedPath = readString(scenario, "expectedPath");
    const expectedHeading = readString(scenario, "expectedHeading");

    addCheck(/^[a-z0-9][a-z0-9-]*$/.test(id), `escenario ${index + 1} tiene id estable`);
    addCheck(!scenarioIds.has(id), `escenario ${id || index + 1} no esta duplicado`);
    scenarioIds.add(id);
    addCheck(knownRoles.has(role), `${id || index + 1} usa rol conocido ${role}`);
    addCheck(
      /^FRONTEND_AUTH_SMOKE_[A-Z0-9_]+_EMAIL$/.test(emailEnv),
      `${id || index + 1} declara emailEnv de smoke`
    );
    addCheck(
      /^FRONTEND_AUTH_SMOKE_[A-Z0-9_]+_PASSWORD$/.test(passwordEnv),
      `${id || index + 1} declara passwordEnv de smoke`
    );
    addCheck(emailEnv !== passwordEnv, `${id || index + 1} separa emailEnv y passwordEnv`);
    addCheck(normalizePath(targetPath), `${id || index + 1} usa targetPath interno`);
    if (expectedPath) {
      addCheck(normalizePath(expectedPath), `${id || index + 1} usa expectedPath interno`);
    }
    addCheck(scenario.requireModuleAccess === true, `${id || index + 1} exige acceso de modulo`);
    addCheck(!Object.hasOwn(scenario, "email"), `${id || index + 1} no versiona email real`);
    addCheck(!Object.hasOwn(scenario, "password"), `${id || index + 1} no versiona password`);
    addCheck(!Object.hasOwn(scenario, "token"), `${id || index + 1} no versiona token`);

    return {
      id,
      role,
      emailEnv,
      passwordEnv,
      targetPath,
      expectedPath,
      expectedHeading
    };
  });
}

const scenarios = parseManifest();
const coveredRoles = new Set(scenarios.map((scenario) => scenario.role));
const workflow = readFile(workflowPath);
const docs = readFile(docsPath);
const packageJson = JSON.parse(readFile(packagePath));

for (const role of minimumRoleCoverage) {
  addCheck(coveredRoles.has(role), `${manifestPath} cubre rol P1 ${role}`);
}

addCheck(
  packageJson.scripts?.["smoke:frontend-authenticated-matrix"] ===
    "node scripts/smoke-frontend-authenticated-matrix.mjs",
  "package.json expone smoke:frontend-authenticated-matrix"
);
addCheck(
  packageJson.scripts?.["audit:frontend-auth-smoke-matrix"] ===
    "node scripts/audit-frontend-auth-smoke-matrix.mjs",
  "package.json expone audit:frontend-auth-smoke-matrix"
);
addCheck(
  packageJson.scripts?.["smoke:frontend-auth-candidates"] ===
    "node scripts/smoke-frontend-auth-candidates.mjs",
  "package.json expone smoke:frontend-auth-candidates"
);
addCheck(
  packageJson.scripts?.["audit:frontend-auth-smoke-secrets"] ===
    "node scripts/audit-frontend-auth-smoke-secrets.mjs",
  "package.json expone audit:frontend-auth-smoke-secrets"
);

for (const requiredPath of [
  "scripts/audit-frontend-auth-smoke-matrix.mjs",
  "scripts/audit-frontend-auth-smoke-secrets.mjs",
  "scripts/smoke-frontend-auth-candidates.mjs",
  "scripts/smoke-frontend-authenticated-matrix.mjs",
  "tests/smoke/**"
]) {
  addCheck(workflow.includes(`- "${requiredPath}"`), `workflow observa cambios en ${requiredPath}`);
}

addCheck(
  workflow.includes("run: npm run audit:frontend-auth-smoke-matrix"),
  "workflow ejecuta audit:frontend-auth-smoke-matrix"
);
addCheck(
  workflow.includes("run: npm run smoke:frontend-authenticated-matrix"),
  "workflow ejecuta smoke:frontend-authenticated-matrix"
);
addCheck(
  workflow.includes("FRONTEND_AUTH_SMOKE_MATRIX_REQUIRED: ${{ vars.FRONTEND_AUTH_SMOKE_MATRIX_REQUIRED }}"),
  "workflow permite activar FRONTEND_AUTH_SMOKE_MATRIX_REQUIRED desde vars"
);

for (const scenario of scenarios) {
  for (const envName of [scenario.emailEnv, scenario.passwordEnv]) {
    const workflowSecretExpression = `${envName}: ` + "${{ secrets." + envName + " }}";
    addCheck(
      workflow.includes(workflowSecretExpression),
      `workflow mapea secret ${envName}`
    );
    addCheck(docs.includes(envName), `docs/smoke-tests.md documenta ${envName}`);
  }

  addCheck(docs.includes(scenario.id), `docs/smoke-tests.md documenta escenario ${scenario.id}`);
  addCheck(docs.includes(scenario.targetPath), `docs/smoke-tests.md documenta ruta ${scenario.targetPath}`);

  if (scenario.expectedPath) {
    addCheck(docs.includes(scenario.expectedPath), `docs/smoke-tests.md documenta expectedPath ${scenario.expectedPath}`);
  }

  if (scenario.expectedHeading) {
    addCheck(
      docs.includes(scenario.expectedHeading),
      `docs/smoke-tests.md documenta heading ${scenario.expectedHeading}`
    );
  }
}

addCheck(
  docs.includes("FRONTEND_AUTH_SMOKE_MATRIX_REQUIRED=1"),
  "docs/smoke-tests.md documenta modo required de matriz"
);
addCheck(
  docs.includes("npm run smoke:frontend-auth-candidates"),
  "docs/smoke-tests.md documenta smoke:frontend-auth-candidates"
);
addCheck(
  docs.includes("SUPABASE_AUTH_SMOKE_CANDIDATES_REQUIRED=1"),
  "docs/smoke-tests.md documenta modo required de candidatos"
);
addCheck(
  docs.includes("npm run audit:frontend-auth-smoke-secrets"),
  "docs/smoke-tests.md documenta audit:frontend-auth-smoke-secrets"
);
addCheck(
  docs.includes("FRONTEND_AUTH_SMOKE_SECRETS_REQUIRED=1"),
  "docs/smoke-tests.md documenta modo required de secrets"
);

const failedChecks = checks.filter((check) => !check.ok);

if (failedChecks.length > 0) {
  console.error("Frontend authenticated smoke matrix audit failed:");
  for (const check of failedChecks) {
    console.error(`- ${check.message}`);
  }
  process.exit(1);
}

console.log("Frontend authenticated smoke matrix audit passed:");
for (const check of checks) {
  console.log(`- ${check.message}`);
}
