#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "scripts", "supabase", ".github"];
const ROOT_FILES = ["package.json", "vite.config.ts", "index.html", ".env.example"];
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
const GLOBAL_WARNING_LIMIT = 82;
const configuredWarningLimit = Number.parseInt(process.env.SUPABASE_SECURITY_WARNING_LIMIT ?? "", 10);
const warningLimit = Number.isFinite(configuredWarningLimit)
  ? Math.min(configuredWarningLimit, GLOBAL_WARNING_LIMIT)
  : GLOBAL_WARNING_LIMIT;
const FOLLOWUP_MIGRATION = "supabase/migrations/20260716025833_harden_operations_bi_orion_audit_followups.sql";
const CORE_FOLLOWUP_MIGRATION = "supabase/migrations/20260722184219_reload_postgrest_after_core_integrity.sql";
const CORE_RELOAD_WARNING_KEY =
  "supabase/migrations/20260722183930_core_data_integrity_hardening.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.";
const SUPERSEDED_WARNING_KEYS = new Set([
  CORE_RELOAD_WARNING_KEY,
  "supabase/migrations/20260609130000_add_orion_session_persistence.sql::SQL grants broad table privileges to authenticated.",
  "supabase/migrations/20260609130000_add_orion_session_persistence.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260610000000_orion_knowledge_base_rag.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260610000001_setup_orion_knowledge_bucket.sql::Storage policy appears scoped only by bucket_id.",
  "supabase/migrations/20260610000001_setup_orion_knowledge_bucket.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260610000002_orion_function_calling_rpcs.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260709091000_tighten_orion_knowledge_admin_write_surface.sql::Storage policy appears scoped only by bucket_id.",
  "supabase/migrations/20260617143000_refactor_bi_backend_with_filters_and_snapshots.sql::SECURITY DEFINER function references p_user_id/target_user_id.",
  "supabase/migrations/20260623235155_align_bi_contract_filters_with_area_dimension.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260624001734_add_bi_recruitment_dashboard.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260624002636_fix_bi_recruitment_dashboard_runtime.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260630133626_align_operations_backend_with_roster_and_catalogs.sql::SECURITY DEFINER function references p_user_id/target_user_id.",
  "supabase/migrations/20260630154500_optimize_operations_driver_search.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260630170500_add_operations_not_performed_status.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260710144556_add_bi_recruitment_daily_timeline_rpc.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260710155452_add_bi_recruitment_job_filter.sql::Migration changes RPC/policy/grants without notify pgrst reload schema.",
  "supabase/migrations/20260715162000_release_operations_module_role_matrix.sql::SECURITY DEFINER function references p_user_id/target_user_id.",
]);

function addFinding(severity, filePath, message, detail = "") {
  const relativePath = path.relative(ROOT, filePath);
  if (isSupersededWarning(relativePath, message)) {
    return;
  }

  findings.push({
    severity,
    filePath: relativePath,
    message,
    detail,
  });
}

function isSupersededWarning(relativePath, message) {
  const key = `${relativePath}::${message}`;
  if (!SUPERSEDED_WARNING_KEYS.has(key)) {
    return false;
  }

  if (key === CORE_RELOAD_WARNING_KEY) {
    const coreFollowupPath = path.join(ROOT, CORE_FOLLOWUP_MIGRATION);
    if (!fs.existsSync(coreFollowupPath)) return false;
    const coreFollowup = fs.readFileSync(coreFollowupPath, "utf8");
    return (
      coreFollowup.includes("20260722183930_core_data_integrity_hardening") &&
      /notify\s+pgrst\s*,\s*'reload schema'/i.test(coreFollowup)
    );
  }

  const followupPath = path.join(ROOT, FOLLOWUP_MIGRATION);
  if (!fs.existsSync(followupPath)) {
    return false;
  }

  const followup = fs.readFileSync(followupPath, "utf8");
  return (
    /user_can_manage_operations\(requested_user_id uuid\)/i.test(followup) &&
    /user_can_access_bi_analytics\(requested_user_id uuid\)/i.test(followup) &&
    /name\s+like\s+'knowledge\/%'/i.test(followup) &&
    /notify\s+pgrst\s*,\s*'reload schema'/i.test(followup)
  );
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

  const warningCount = grouped.warning ?? 0;
  if (warningCount > warningLimit) {
    console.error(
      `Supabase security audit warning limit exceeded: ${warningCount}/${warningLimit}. ` +
        "Corrige el warning nuevo antes de continuar.",
    );
    process.exitCode = 1;
  }

  if (findings.some((finding) => finding.severity === "critical")) {
    process.exitCode = 1;
  }
}

main();
