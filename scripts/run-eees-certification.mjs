#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { certificationState, readJson, validateSuppressions } from "./eees-governance-lib.mjs";

const root = process.cwd();
const evidenceDir = path.join(root, ".eees/evidence");
fs.mkdirSync(evidenceDir, { recursive: true });
const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const workspaceDirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
const gates = readJson(path.join(root, "eees/guardian/gates.json")).gates;
const results = [];

for (const gate of gates) {
  const started = Date.now();
  const [command, ...args] = gate.command.split(" ");
  const execution = spawnSync(command, args, { cwd: root, encoding: "utf8", env: process.env });
  const combinedOutput = `${execution.stdout ?? ""}\n${execution.stderr ?? ""}`;
  const summaryWarningCount = [...combinedOutput.matchAll(/"warning"\s*:\s*(\d+)/g)]
    .reduce((highest, match) => Math.max(highest, Number(match[1])), 0);
  const lineWarningCount = (combinedOutput.match(/^\[warning\]/gim) ?? []).length;
  const warningCount = Math.max(summaryWarningCount, lineWarningCount);
  results.push({
    gate: gate.id,
    command: gate.command,
    result: execution.status === 0 ? "PASS" : "FAIL",
    exitCode: execution.status ?? 1,
    durationMs: Date.now() - started,
    rules: gate.rules,
    warningCount,
    findingSummary: execution.status === 0 ? [] : ["El comando fallo; consultar log de CI del gate."],
    tool: `${command} ${process.version}`
  });
  process.stdout.write(execution.stdout ?? "");
  process.stderr.write(execution.stderr ?? "");
}

const suppressions = readJson(path.join(root, "eees/guardian/suppressions.json"));
const suppressionFindings = validateSuppressions(suppressions);
const errors = results.filter((result) => result.result === "FAIL").length + suppressionFindings.length;
const warnings = results.reduce((total, result) => total + result.warningCount, 0)
  + (suppressions.suppressions?.length ?? 0);
const generatedAt = new Date().toISOString();
const evidence = { schemaVersion: 1, standardVersion: "2.0.0", generatedAt, commit: currentCommit, branch, gates: results };
const state = workspaceDirty
  ? "STALE"
  : certificationState({ errors, warnings, evidenceCommit: currentCommit, currentCommit, generatedAt });
const certification = { schemaVersion: 1, standardVersion: "2.0.0", generatedAt, commit: currentCommit, workspaceDirty, state, errors, warnings, evidence: ".eees/evidence/latest.json" };
fs.writeFileSync(path.join(evidenceDir, "latest.json"), `${JSON.stringify(evidence, null, 2)}\n`);
fs.writeFileSync(path.join(evidenceDir, "certification.json"), `${JSON.stringify(certification, null, 2)}\n`);
console.log(`EEES certification state: ${state}`);
if (state === "NOT_CERTIFIED") process.exit(1);
