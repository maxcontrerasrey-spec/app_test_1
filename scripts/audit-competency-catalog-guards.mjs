#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
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

for (const expectedType of ["Bus 1 Piso", "Bus 1 1/2 Piso", "Bus 2 Pisos", "Mini Bus"]) {
  addCheck(migrationSources.includes(expectedType), `tipo ERP disponible: ${expectedType}`);
}

for (const expectedModel of [
  "O 500 RSD",
  "F 310 HB",
  "K410 C",
  "K 440 IB",
  "K400 C",
  "K 450-C",
  "B 450 R",
  "DELIBERY -9 - E DELIBERY -9",
  "XMQ6130 E",
  "ZK6709 H"
]) {
  addCheck(migrationSources.includes(expectedModel), `modelo solicitado disponible: ${expectedModel}`);
}

addCheck(
  /king-long/.test(migrationSources) && /KING LONG/.test(migrationSources),
  "marca KING LONG disponible en catalogo de certificados"
);
addCheck(
  /yutong-c9-zk6709h/.test(migrationSources) &&
    /brand\.code\s*=\s*'yutong'/.test(migrationSources) &&
    /equipment_type\.code\s*=\s*'bus-1-piso'/.test(migrationSources) &&
    /Reclasificado desde Taxibus a Bus 1 Piso/.test(migrationSources),
  "YUTONG ZK6709 H queda reclasificado como Bus 1 Piso, no Taxibus"
);

const failedChecks = checks.filter((check) => !check.ok);

if (failedChecks.length > 0) {
  console.error("Competency catalog guard audit failed:");
  for (const check of failedChecks) {
    console.error(`- ${check.message}`);
  }
  process.exit(1);
}

console.log("Competency catalog guard audit passed:");
for (const check of checks) {
  console.log(`- ${check.message}`);
}
