#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const defaultBaselinePath = path.join(repoRoot, "supabase", "migration-baseline.json");
const canonicalCutoverVersion = "20260612120000";

const args = new Set(process.argv.slice(2));
const shouldWriteBaseline = args.has("--write-baseline");
const shouldEnforceBaseline = args.has("--enforce-baseline");
const shouldPrintJson = args.has("--json");

function classifyMigrationFile(fileName) {
  const canonicalMatch = fileName.match(/^(\d{14})_(.+)\.sql$/);

  if (canonicalMatch) {
    return {
      fileName,
      naming: "canonical",
      normalizedVersion: canonicalMatch[1],
      description: canonicalMatch[2]
    };
  }

  const legacyMatch = fileName.match(/^(\d{8})_(\d{6})_(.+)\.sql$/);

  if (legacyMatch) {
    return {
      fileName,
      naming: "legacy",
      normalizedVersion: `${legacyMatch[1]}${legacyMatch[2]}`,
      description: legacyMatch[3]
    };
  }

  return {
    fileName,
    naming: "invalid",
    normalizedVersion: null,
    description: null
  };
}

function readMigrationInventory() {
  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  const classified = sqlFiles.map(classifyMigrationFile);
  const canonical = classified.filter((item) => item.naming === "canonical");
  const legacy = classified.filter((item) => item.naming === "legacy");
  const invalid = classified.filter((item) => item.naming === "invalid");

  const versionMap = new Map();
  const namingByDay = new Map();

  for (const item of [...canonical, ...legacy]) {
    const current = versionMap.get(item.normalizedVersion) ?? [];
    current.push(item.fileName);
    versionMap.set(item.normalizedVersion, current);

    const dayKey = item.normalizedVersion.slice(0, 8);
    const dayBucket = namingByDay.get(dayKey) ?? { canonical: 0, legacy: 0 };
    dayBucket[item.naming] += 1;
    namingByDay.set(dayKey, dayBucket);
  }

  const duplicates = [...versionMap.entries()]
    .filter(([, fileNames]) => fileNames.length > 1)
    .map(([normalizedVersion, fileNames]) => ({
      normalizedVersion,
      fileNames: [...fileNames].sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => left.normalizedVersion.localeCompare(right.normalizedVersion));

  return {
    sqlFiles,
    canonical,
    legacy,
    invalid,
    duplicates,
    namingByDay
  };
}

function buildSummary(inventory) {
  const allVersions = [...inventory.canonical, ...inventory.legacy]
    .map((item) => item.normalizedVersion)
    .sort((left, right) => left.localeCompare(right));

  return {
    reviewedAt: new Date().toISOString(),
    migrationDir: "supabase/migrations",
    canonicalCutoverVersion,
    totalSqlFiles: inventory.sqlFiles.length,
    canonicalCount: inventory.canonical.length,
    legacyCount: inventory.legacy.length,
    invalidCount: inventory.invalid.length,
    duplicateNormalizedVersionCount: inventory.duplicates.length,
    earliestNormalizedVersion: allVersions[0] ?? null,
    latestNormalizedVersion: allVersions.at(-1) ?? null,
    duplicateNormalizedVersions: inventory.duplicates,
    invalidFiles: inventory.invalid.map((item) => item.fileName),
    recentCanonicalFiles: inventory.canonical
      .filter((item) => item.normalizedVersion >= canonicalCutoverVersion)
      .map((item) => item.fileName),
    legacyFiles: inventory.legacy.map((item) => item.fileName),
    dailyMix: [...inventory.namingByDay.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([dayKey, counts]) => ({
        dayKey,
        canonicalCount: counts.canonical,
        legacyCount: counts.legacy
      }))
  };
}

function writeBaselineFile(summary, baselinePath) {
  const payload = {
    generatedAt: summary.reviewedAt,
    migrationDir: summary.migrationDir,
    canonicalCutoverVersion: summary.canonicalCutoverVersion,
    allowedLegacyFiles: summary.legacyFiles,
    allowedDuplicateNormalizedVersions: Object.fromEntries(
      summary.duplicateNormalizedVersions.map((item) => [item.normalizedVersion, item.fileNames])
    ),
    notes: [
      "This baseline freezes the current legacy migration debt without renaming or replaying historical SQL.",
      "New migrations must use the canonical 14-digit format and must not introduce new normalized-version collisions."
    ]
  };

  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function enforceBaseline(summary, baselinePath) {
  if (!fs.existsSync(baselinePath)) {
    throw new Error(
      `No existe el baseline requerido en ${path.relative(repoRoot, baselinePath)}. Ejecuta primero --write-baseline.`
    );
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const allowedLegacy = new Set(baseline.allowedLegacyFiles ?? []);
  const allowedDuplicates = new Map(
    Object.entries(baseline.allowedDuplicateNormalizedVersions ?? {}).map(([normalizedVersion, fileNames]) => [
      normalizedVersion,
      [...fileNames].sort((left, right) => left.localeCompare(right))
    ])
  );

  const errors = [];
  const unexpectedLegacy = summary.legacyFiles.filter((fileName) => !allowedLegacy.has(fileName));

  if (summary.invalidCount > 0) {
    errors.push(
      `Hay archivos con naming inválido en supabase/migrations: ${summary.invalidFiles.join(", ")}`
    );
  }

  if (unexpectedLegacy.length > 0) {
    errors.push(
      `Se detectaron migraciones legacy nuevas fuera del baseline: ${unexpectedLegacy.join(", ")}`
    );
  }

  for (const item of summary.duplicateNormalizedVersions) {
    const allowed = allowedDuplicates.get(item.normalizedVersion);

    if (!allowed) {
      errors.push(
        `La versión normalizada ${item.normalizedVersion} ahora tiene colisión no permitida: ${item.fileNames.join(", ")}`
      );
      continue;
    }

    if (allowed.join("|") !== item.fileNames.join("|")) {
      errors.push(
        `La colisión permitida para ${item.normalizedVersion} cambió y requiere revisión manual. Actual: ${item.fileNames.join(", ")}`
      );
    }
  }

  if (errors.length > 0) {
    console.error("Supabase migration audit failed:\n");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Supabase migration audit passed against the frozen legacy baseline.");
}

function printHumanSummary(summary) {
  console.log("Supabase migration audit summary");
  console.log(`- SQL files: ${summary.totalSqlFiles}`);
  console.log(`- Canonical (14 digits): ${summary.canonicalCount}`);
  console.log(`- Legacy split format: ${summary.legacyCount}`);
  console.log(`- Invalid naming: ${summary.invalidCount}`);
  console.log(`- Duplicate normalized versions: ${summary.duplicateNormalizedVersionCount}`);

  if (summary.duplicateNormalizedVersions.length > 0) {
    for (const item of summary.duplicateNormalizedVersions) {
      console.log(`  - ${item.normalizedVersion}: ${item.fileNames.join(", ")}`);
    }
  }
}

const inventory = readMigrationInventory();
const summary = buildSummary(inventory);

if (shouldPrintJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printHumanSummary(summary);
}

if (shouldWriteBaseline) {
  writeBaselineFile(summary, defaultBaselinePath);
  console.log(`Baseline escrito en ${path.relative(repoRoot, defaultBaselinePath)}`);
}

if (shouldEnforceBaseline) {
  enforceBaseline(summary, defaultBaselinePath);
}
