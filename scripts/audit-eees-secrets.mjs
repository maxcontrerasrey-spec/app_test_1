#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const excluded = /(^|\/)(package-lock\.json|coverage|dist|node_modules|\.git)(\/|$)|\.(png|jpe?g|gif|webp|ico|pdf|zip|woff2?)$/i;
export const SECRET_PATTERNS = [
  { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "GitHub token", regex: /\bgh[oprsu]_[A-Za-z0-9_]{30,}\b/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "JWT", regex: /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
  { name: "Supabase secret key", regex: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/ },
  { name: "OpenAI API key", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: "npm access token", regex: /\bnpm_[A-Za-z0-9]{30,}\b/ },
  { name: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "Google API key", regex: /\bAIza[A-Za-z0-9_-]{30,}\b/ },
  { name: "Stripe live secret", regex: /\bsk_live_[A-Za-z0-9]{20,}\b/ },
  { name: "Bearer credential", regex: /\bBearer\s+[A-Za-z0-9._~-]{24,}\b/i },
];

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

export function repositoryFiles(root = process.cwd()) {
  const tracked = git(root, ["ls-files"]);
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard"]);
  return [...new Set(`${tracked}\n${untracked}`.split("\n").filter(Boolean))];
}

export function scanSecretContent(content) {
  return SECRET_PATTERNS.filter(({ regex }) => regex.test(content)).map(({ name }) => name);
}

export function auditRepositorySecrets(root = process.cwd()) {
  const files = repositoryFiles(root);
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    if (excluded.test(file)) continue;
    const absolutePath = path.join(root, file);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) continue;
    const content = fs.readFileSync(absolutePath, "utf8");
    scanned += 1;
    for (const name of scanSecretContent(content)) findings.push(`${file}: posible ${name}`);
  }
  return { files, findings, scanned };
}

function main() {
  const { findings, scanned } = auditRepositorySecrets();
  if (findings.length) {
    console.error("Secret scan failed (valores ocultos):");
    findings.forEach((finding) => console.error(`- ${finding}`));
    process.exit(1);
  }
  console.log(`Secret scan passed: ${scanned} archivos versionados o locales evaluados sin imprimir valores.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
