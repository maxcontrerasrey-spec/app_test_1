#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const findings = [];
const alternateLocks = ["yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"].filter((file) => fs.existsSync(path.join(root, file)));
if (!fs.existsSync(path.join(root, "package-lock.json"))) findings.push("Falta package-lock.json canonico");
if (alternateLocks.length) findings.push(`Lockfiles alternativos: ${alternateLocks.join(", ")}`);

const workflowsRoot = path.join(root, ".github/workflows");
for (const entry of fs.readdirSync(workflowsRoot).filter((file) => /\.ya?ml$/.test(file))) {
  const file = path.join(workflowsRoot, entry);
  const content = fs.readFileSync(file, "utf8");
  if (/pull_request_target\s*:/.test(content)) findings.push(`${entry}: pull_request_target requiere revision explicita`);
  if (/permissions\s*:\s*write-all/.test(content)) findings.push(`${entry}: write-all no respeta least privilege`);
  for (const match of content.matchAll(/uses:\s*([^\s#]+)/g)) {
    const reference = match[1];
    if (/^\.\//.test(reference) || /docker:\/\//.test(reference)) continue;
    const ref = reference.split("@")[1] ?? "";
    if (!/^[0-9a-f]{40}$/.test(ref)) {
      findings.push(`${entry}: action externa no fijada a SHA inmutable (${reference})`);
    }
  }
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)run:\s*(\|\s*)?$/);
    if (!match) continue;
    const indent = match[1].length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (line.trim() && line.match(/^\s*/)[0].length <= indent) break;
      if (/\$\{\{\s*inputs\./.test(line)) {
        findings.push(`${entry}:${cursor + 1}: input interpolado directamente en shell; usar env y validar formato`);
      }
    }
  }
}

const auditWorkflow = fs.readFileSync(path.join(workflowsRoot, "audit-supabase-migrations.yml"), "utf8");
if (!auditWorkflow.includes("npm ci")) findings.push("CI principal no usa npm ci");

if (findings.length) {
  console.error("CI/supply-chain audit failed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}
console.log("CI/supply-chain audit passed: npm reproducible, permisos y actions revisados.");
