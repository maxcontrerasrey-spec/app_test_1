#!/usr/bin/env node

import fs from "node:fs";
import { execFileSync } from "node:child_process";

function changedMigrationFiles() {
  const outputs = [
    execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", "HEAD"], { encoding: "utf8" }),
    execFileSync("git", ["ls-files", "--others", "--exclude-standard", "supabase/migrations"], { encoding: "utf8" })
  ];
  return [...new Set(outputs.join("\n").split("\n").filter((file) => /^supabase\/migrations\/.*\.sql$/.test(file)))];
}

const destructive = /\b(drop\s+(?:table|column|schema|type)|truncate\s+table|alter\s+table[\s\S]{0,180}\bdrop\s+column|delete\s+from\s+\S+\s*;)/i;
const approval = /EEES-DB-005:\s*approved[\s\S]{0,500}owner:\s*\S+[\s\S]{0,500}rollback:/i;
const findings = [];
for (const file of changedMigrationFiles()) {
  const sql = fs.readFileSync(file, "utf8");
  if (destructive.test(sql) && !approval.test(sql)) findings.push(`${file}: cambio destructivo sin owner y rollback EEES-DB-005`);
}

if (findings.length) {
  console.error("Destructive migration guard failed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}
console.log("Destructive migration guard passed para migraciones nuevas o modificadas.");
