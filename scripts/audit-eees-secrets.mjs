#!/usr/bin/env node

import fs from "node:fs";
import { execFileSync } from "node:child_process";

const excluded = /(^|\/)(package-lock\.json|coverage|dist|node_modules|\.git)(\/|$)|\.(png|jpe?g|gif|webp|ico|pdf|zip|woff2?)$/i;
const patterns = [
  { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "GitHub token", regex: /\bgh[oprsu]_[A-Za-z0-9_]{30,}\b/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Supabase service role JWT", regex: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ }
];

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
const findings = [];
for (const file of files) {
  if (excluded.test(file) || !fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  patterns.forEach(({ name, regex }) => {
    if (regex.test(content)) findings.push(`${file}: posible ${name}`);
  });
}

if (findings.length) {
  console.error("Secret scan failed (valores ocultos):");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}
console.log(`Secret scan passed: ${files.length} rutas versionadas evaluadas sin imprimir valores.`);
