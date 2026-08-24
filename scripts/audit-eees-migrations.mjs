#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MIGRATION_PATTERN = /^supabase\/migrations\/.*\.sql$/;
const ZERO_SHA_PATTERN = /^0+$/;
const DESTRUCTIVE_PATTERNS = [
  /\bdrop\s+(?:table|column|schema|type|policy|function|view|materialized\s+view|index|trigger|constraint)\b/i,
  /\btruncate\s+(?:table\s+)?\S+/i,
  /\bdelete\s+from\s+\S+\s*(?:where\s+[^;]+)?;/i,
  /\brevoke\s+[^;]+\bfrom\b/i,
  /\balter\s+table\b[\s\S]{0,240}\b(?:drop|rename|alter\s+column\b[\s\S]{0,120}\b(?:type|set\s+not\s+null))\b/i,
  /\balter\s+type\b[\s\S]{0,180}\brename\b/i,
];
const APPROVAL_PATTERN = /(?:^|\n)\s*--\s*EEES-DB-005:\s*approved\s*(?:\r?\n)\s*--\s*owner:\s*\S[^\r\n]*\s*(?:\r?\n)\s*--\s*rollback:\s*\S[^\r\n]*/i;

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function parseFiles(output) {
  return output.split("\n").filter((file) => MIGRATION_PATTERN.test(file));
}

export function changedMigrationFiles({ root = process.cwd(), env = process.env } = {}) {
  const baseSha = env.EEES_BASE_SHA?.trim();
  const headSha = env.EEES_HEAD_SHA?.trim() || "HEAD";
  const isCi = env.CI === "true" || env.GITHUB_ACTIONS === "true";

  if (baseSha && !ZERO_SHA_PATTERN.test(baseSha)) {
    git(root, ["cat-file", "-e", `${baseSha}^{commit}`]);
    git(root, ["cat-file", "-e", `${headSha}^{commit}`]);
    return [...new Set(parseFiles(git(root, [
      "diff", "--name-only", "--diff-filter=ACMR", baseSha, headSha, "--", "supabase/migrations",
    ])))];
  }

  if (isCi) {
    throw new Error("CI no entrego EEES_BASE_SHA valido; no es seguro certificar migraciones sin rango Git.");
  }

  const changed = parseFiles(git(root, [
    "diff", "--name-only", "--diff-filter=ACMR", "HEAD", "--", "supabase/migrations",
  ]));
  const untracked = parseFiles(git(root, [
    "ls-files", "--others", "--exclude-standard", "supabase/migrations",
  ]));
  return [...new Set([...changed, ...untracked])];
}

export function auditMigrationSql(sql) {
  const destructive = DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(sql));
  if (!destructive) return [];
  if (APPROVAL_PATTERN.test(sql)) return [];
  return ["cambio destructivo sin cabecera EEES-DB-005 con owner y rollback"];
}

export function auditChangedMigrations({ root = process.cwd(), env = process.env } = {}) {
  const findings = [];
  const files = changedMigrationFiles({ root, env });
  for (const file of files) {
    const absolutePath = path.join(root, file);
    if (!fs.existsSync(absolutePath)) continue;
    for (const message of auditMigrationSql(fs.readFileSync(absolutePath, "utf8"))) {
      findings.push(`${file}: ${message}`);
    }
  }
  return { files, findings };
}

function main() {
  try {
    const { files, findings } = auditChangedMigrations();
    if (findings.length) {
      console.error("Destructive migration guard failed:");
      findings.forEach((finding) => console.error(`- ${finding}`));
      process.exit(1);
    }
    console.log(`Destructive migration guard passed: ${files.length} migracion(es) del rango evaluadas.`);
  } catch (error) {
    console.error(`Destructive migration guard blocked: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
