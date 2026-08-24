#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const outputDir = path.join(process.cwd(), ".eees/evidence");
fs.mkdirSync(outputDir, { recursive: true });
const result = spawnSync("npm", [
  "sbom",
  "--package-lock-only",
  "--sbom-format",
  "cyclonedx",
  "--sbom-type",
  "application"
], { encoding: "utf8" });
if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "No fue posible generar SBOM.\n");
  process.exit(result.status ?? 1);
}
const sbom = JSON.parse(result.stdout);
if (sbom.bomFormat !== "CycloneDX" || !sbom.specVersion || !Array.isArray(sbom.components)) {
  console.error("El SBOM generado no cumple el contrato CycloneDX esperado.");
  process.exit(1);
}
fs.writeFileSync(path.join(outputDir, "sbom.cdx.json"), result.stdout);
console.log(`SBOM CycloneDX completo generado con ${sbom.components.length} componentes.`);
