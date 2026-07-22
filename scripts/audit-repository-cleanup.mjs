import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const checks = [];

function addCheck(ok, message) {
  checks.push({ ok, message });
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

const removedFiles = [
  "artifacts/EEES_ENTERPRISE_FINAL.zip",
  "scripts/fix-migrations.mjs",
  "scripts/provision-competency-instructors.mjs",
  "scripts/provision-hiring-approvers-from-cecos.mjs",
  "scripts/test-bi-rpc.mjs",
  "scripts/validate-buk-token-access.mjs",
  "src/shared/services/catalogs.ts",
  "src/shared/data/catalogoVehiculos.csv",
  "src/shared/data/instructores.csv",
  "src/shared/data/trabajadores.csv",
  "src/shared/ui/ModulePlaceholderPage.tsx",
  "public/assets/login-control.png",
  "public/assets/login-planificacion.png",
  "public/assets/login-registro.png",
  "public/assets/nav-base.png",
  "public/assets/nav-export.png",
  "public/assets/nav-home.png",
  "public/assets/nav-specials.png",
  "src/assets/certification-icon.png",
  "src/assets/operacion.png",
  "src/assets/recruiting-icon.png",
  "src/assets/recursos-humanos.png",
  "src/assets/status-alert.png",
  "src/assets/status-error.png",
  "src/assets/status-pending.png",
  "src/assets/status-success.png"
];

for (const file of removedFiles) {
  addCheck(!exists(file), `${file} permanece eliminado`);
}

const packageJson = readJson("package.json");
const directDependencies = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {})
};

for (const dependency of ["@tanstack/query-core", "react-is", "pdf-parse"]) {
  addCheck(!(dependency in directDependencies), `${dependency} no es dependencia directa`);
}

const tracked = trackedFiles();
let trackedZipCount = 0;
let trackedDsStoreCount = 0;
let trackedTsBuildInfoCount = 0;
for (const file of tracked) {
  if (!exists(file)) {
    continue;
  }
  if (file.endsWith(".zip")) {
    trackedZipCount += 1;
    addCheck(false, `${file} es zip versionado`);
  }
  if (file.endsWith(".DS_Store")) {
    trackedDsStoreCount += 1;
    addCheck(false, `${file} es .DS_Store versionado`);
  }
  if (file.endsWith(".tsbuildinfo")) {
    trackedTsBuildInfoCount += 1;
    addCheck(false, `${file} es tsbuildinfo versionado`);
  }
}

addCheck(trackedZipCount === 0, "0 zip versionados activos");
addCheck(trackedDsStoreCount === 0, "0 .DS_Store versionados activos");
addCheck(trackedTsBuildInfoCount === 0, "0 tsbuildinfo versionados activos");

for (const required of [
  "eees/baselines/REPOSITORY-CLEANUP-BASELINE_v1.md",
  "eees/audits/REPOSITORY-CLEANUP-INVENTORY.md",
  "eees/audits/REPOSITORY-CLEANUP-CLOSURE-REPORT.md"
]) {
  addCheck(exists(required), `${required} existe`);
}

const failedChecks = checks.filter((check) => !check.ok);
if (failedChecks.length > 0) {
  console.error("Repository cleanup audit failed:");
  for (const check of failedChecks) {
    console.error(`- ${check.message}`);
  }
  process.exit(1);
}

console.log("Repository cleanup audit passed:");
for (const check of checks) {
  console.log(`- ${check.message}`);
}
