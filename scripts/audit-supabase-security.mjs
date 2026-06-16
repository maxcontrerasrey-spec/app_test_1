#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "scripts", "supabase", ".github"];
const ROOT_FILES = ["package.json", "test-db.cjs", "sync-doc.cjs", "process-pdf.mjs"];
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
]);

const findings = [];

function addFinding(severity, filePath, message, detail = "") {
  findings.push({
    severity,
    filePath: path.relative(ROOT, filePath),
    message,
    detail,
  });
}

function listFiles(startPath) {
  if (!fs.existsSync(startPath)) return [];
  const stat = fs.statSync(startPath);
  if (stat.isFile()) return [startPath];

  const entries = fs.readdirSync(startPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") {
      return [];
    }

    return listFiles(path.join(startPath, entry.name));
  });
}

function readIfText(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const extension = path.extname(filePath);
  if (!TEXT_EXTENSIONS.has(extension)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function auditSecrets(filePath, content) {
  const jwtLikeTokens = content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? [];

  for (const token of jwtLikeTokens) {
    const decodedPayload = decodeJwtPayload(token);
    if (decodedPayload?.role === "service_role") {
      addFinding(
        "critical",
        filePath,
        "Hardcoded Supabase service_role JWT detected.",
        "Move the value to SUPABASE_SERVICE_ROLE_KEY and rotate the leaked key.",
      );
    }
  }
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function auditSql(filePath, content) {
  if (!filePath.endsWith(".sql")) return;

  if (/\bgrant\s+execute\b[\s\S]{0,160}\bto\s+(public|anon)\b/i.test(content)) {
    addFinding("warning", filePath, "SQL grants EXECUTE to public or anon.");
  }

  if (/\bgrant\s+(all|select\s*,?\s*insert|insert\s*,?\s*update|update\s*,?\s*delete)[\s\S]{0,180}\bto\s+authenticated\b/i.test(content)) {
    addFinding("warning", filePath, "SQL grants broad table privileges to authenticated.");
  }

  if (/security\s+definer/i.test(content) && /\b(p_user_id|target_user_id)\b/i.test(content)) {
    addFinding(
      "warning",
      filePath,
      "SECURITY DEFINER function references p_user_id/target_user_id.",
      "Validate that the function binds the requested user to auth.uid() or admin bypass.",
    );
  }

  const broadStoragePolicy = /create\s+policy[\s\S]{0,500}on\s+storage\.objects[\s\S]{0,800}bucket_id\s*=\s*'[^']+'[\s\S]{0,200}(;|\))/i;
  if (broadStoragePolicy.test(content) && !/\bstorage\.filename\s*\(|\bname\s+like\b|\bexists\s*\(/i.test(content)) {
    addFinding(
      "warning",
      filePath,
      "Storage policy appears scoped only by bucket_id.",
      "Review path/case ownership before considering it safe.",
    );
  }

  const changesPostgrestSurface =
    /create\s+(or\s+replace\s+)?function|create\s+policy|drop\s+policy|grant\s+execute|revoke\s+.*function/i.test(content);
  if (changesPostgrestSurface && !/notify\s+pgrst\s*,\s*'reload schema'/i.test(content)) {
    addFinding("warning", filePath, "Migration changes RPC/policy/grants without notify pgrst reload schema.");
  }
}

function main() {
  const files = [
    ...SCAN_DIRS.flatMap((dir) => listFiles(path.join(ROOT, dir))),
    ...ROOT_FILES.map((file) => path.join(ROOT, file)),
  ];

  for (const filePath of files) {
    const content = readIfText(filePath);
    if (content == null) continue;
    auditSecrets(filePath, content);
    auditSql(filePath, content);
  }

  if (findings.length === 0) {
    console.log("Supabase security audit: no findings.");
    return;
  }

  const grouped = findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});

  console.log("Supabase security audit findings:");
  console.log(JSON.stringify(grouped, null, 2));

  for (const finding of findings) {
    const detail = finding.detail ? ` ${finding.detail}` : "";
    console.log(`[${finding.severity}] ${finding.filePath}: ${finding.message}${detail}`);
  }

  if (findings.some((finding) => finding.severity === "critical")) {
    process.exitCode = 1;
  }
}

main();
