import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const requiredDocs = [
  "docs/architecture.md",
  "docs/module-map.md",
  "docs/permissions-matrix.md",
  "docs/security-review.md",
  "docs/smoke-tests.md",
  "docs/rollback.md",
  "tasks/todo.md",
  "tasks/lessons.md"
];

const checks = [];

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function addCheck(ok, message) {
  checks.push({ ok, message });
}

for (const docPath of requiredDocs) {
  addCheck(fs.existsSync(path.join(rootDir, docPath)), `${docPath} existe`);
}

const appRouter = readFile("src/app/router/AppRouter.tsx");
const moduleMap = readFile("docs/module-map.md");
const permissionsMatrix = readFile("docs/permissions-matrix.md");
const securityReview = readFile("docs/security-review.md");
const smokeTests = readFile("docs/smoke-tests.md");
const todo = readFile("tasks/todo.md");

const routedModuleCodes = Array.from(appRouter.matchAll(/moduleCode="([^"]+)"/g))
  .map((match) => match[1])
  .filter((value, index, values) => values.indexOf(value) === index)
  .sort();

for (const moduleCode of routedModuleCodes) {
  addCheck(
    permissionsMatrix.includes(`\`${moduleCode}\``),
    `docs/permissions-matrix.md documenta el modulo routeado ${moduleCode}`
  );
}

const routeModules = readFile("src/app/router/routeModules.ts");
const routedModuleDirectories = Array.from(routeModules.matchAll(/\.\.\/\.\.\/modules\/([^/]+)\//g))
  .map((match) => match[1])
  .filter((value, index, values) => values.indexOf(value) === index)
  .sort();

for (const directory of routedModuleDirectories) {
  addCheck(
    moduleMap.includes(`src/modules/${directory}`),
    `docs/module-map.md referencia src/modules/${directory}`
  );
}

const requiredSecuritySections = ["Riesgos corregidos", "Riesgos pendientes", "Recomendacion priorizada"];
for (const section of requiredSecuritySections) {
  addCheck(securityReview.includes(section), `docs/security-review.md mantiene seccion "${section}"`);
}

const requiredSmokeSections = ["Gating actual", "Matriz minima por rol", "Flujos criticos"];
for (const section of requiredSmokeSections) {
  addCheck(smokeTests.includes(section), `docs/smoke-tests.md mantiene seccion "${section}"`);
}

addCheck(
  todo.includes("Loop Enterprise global"),
  "tasks/todo.md registra la iteracion activa del loop Enterprise global"
);

const failedChecks = checks.filter((check) => !check.ok);

if (failedChecks.length > 0) {
  console.error("Enterprise docs audit failed:");
  for (const check of failedChecks) {
    console.error(`- ${check.message}`);
  }
  process.exit(1);
}

console.log("Enterprise docs audit passed:");
for (const check of checks) {
  console.log(`- ${check.message}`);
}
