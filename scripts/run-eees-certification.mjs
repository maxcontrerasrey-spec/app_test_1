#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { certificationState, isCertificationPassingState, readJson, validateSuppressions } from "./eees-governance-lib.mjs";

const root = process.cwd();
const evidenceDir = path.join(root, ".eees/evidence");
fs.mkdirSync(evidenceDir, { recursive: true });
const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const workspaceDirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
const gates = readJson(path.join(root, "eees/guardian/gates.json")).gates;
const rules = readJson(path.join(root, "eees/guardian/rules.json"));
const results = [];

for (const gate of gates) {
  if (gate.kind === "certifier") continue;
  const started = Date.now();
  const executable = gate.executable === "npm" && process.platform === "win32" ? "npm.cmd" : gate.executable;
  const execution = spawnSync(executable, gate.args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    timeout: 15 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const combinedOutput = `${execution.stdout ?? ""}\n${execution.stderr ?? ""}`;
  const summaryWarningCount = [...combinedOutput.matchAll(/"warning"\s*:\s*(\d+)/g)]
    .reduce((highest, match) => Math.max(highest, Number(match[1])), 0);
  const lineWarningCount = (combinedOutput.match(/^(?:\[warning\]|Performance budget warning:)/gim) ?? []).length;
  const warningCount = Math.max(summaryWarningCount, lineWarningCount);
  const command = [gate.executable, ...gate.args].join(" ");
  const processError = execution.error?.message;
  results.push({
    gate: gate.id,
    command,
    result: execution.status === 0 ? "PASS" : "FAIL",
    exitCode: execution.status ?? 1,
    durationMs: Date.now() - started,
    rules: gate.rules,
    observationCount: warningCount,
    findingSummary: execution.status === 0 ? [] : [processError ?? "El comando fallo; consultar log de CI del gate."],
    runtime: process.version,
  });
  process.stdout.write(execution.stdout ?? "");
  process.stderr.write(execution.stderr ?? "");
}

const suppressions = readJson(path.join(root, "eees/guardian/suppressions.json"));
const suppressionFindings = validateSuppressions(suppressions, new Date(), rules);
const observations = results.reduce((total, result) => total + result.observationCount, 0);
const acceptedRisks = suppressions.suppressions?.length ?? 0;
const generatedAt = new Date().toISOString();
const sbomPath = path.join(evidenceDir, "sbom.cdx.json");
const sbomSha256 = fs.existsSync(sbomPath)
  ? crypto.createHash("sha256").update(fs.readFileSync(sbomPath)).digest("hex")
  : null;
if (!sbomSha256) results.push({
  gate: "certification-integrity",
  result: "FAIL",
  exitCode: 1,
  durationMs: 0,
  rules: ["GOV-002", "SUP-005"],
  observationCount: 0,
  findingSummary: ["No existe SBOM para vincular a la evidencia."],
  runtime: process.version,
});
else results.push({
  gate: "certification-integrity",
  result: "PASS",
  exitCode: 0,
  durationMs: 0,
  rules: ["GOV-002"],
  observationCount: 0,
  findingSummary: [],
  runtime: process.version,
});
const totalErrors = results.filter((result) => result.result === "FAIL").length + suppressionFindings.length;
const evidence = {
  schemaVersion: 2,
  standardVersion: "2.0.0",
  generatedAt,
  commit: currentCommit,
  branch,
  observations,
  acceptedRisks,
  artifactHashes: { sbomSha256 },
  gates: results,
};
const evidenceContents = `${JSON.stringify(evidence, null, 2)}\n`;
const evidenceSha256 = crypto.createHash("sha256").update(evidenceContents).digest("hex");
const state = workspaceDirty
  ? "STALE"
  : certificationState({ errors: totalErrors, unresolvedWarnings: 0, acceptedRisks, evidenceCommit: currentCommit, currentCommit, generatedAt });
const certification = {
  schemaVersion: 2,
  standardVersion: "2.0.0",
  generatedAt,
  commit: currentCommit,
  workspaceDirty,
  state,
  errors: totalErrors,
  observations,
  acceptedRisks,
  evidence: ".eees/evidence/latest.json",
  evidenceSha256,
};
fs.writeFileSync(path.join(evidenceDir, "latest.json"), evidenceContents);
fs.writeFileSync(path.join(evidenceDir, "certification.json"), `${JSON.stringify(certification, null, 2)}\n`);
console.log(`EEES certification state: ${state}`);
if (!isCertificationPassingState(state)) process.exit(1);
