import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read(
  "supabase/migrations/20260806021503_harden_internal_rpc_and_password_reset.sql"
);

describe("security hardening", () => {
  it("makes password-change completion backend authoritative", () => {
    const authApi = read("src/modules/auth/services/authApi.ts");

    expect(migration).toContain("after update of encrypted_password on auth.users");
    expect(migration).toContain("revoke update on public.profiles from authenticated");
    const compatibilityMigration = read(
      "supabase/migrations/20260806023102_allow_safe_password_reset_noop_compatibility.sql"
    );
    expect(compatibilityMigration).toContain("and must_reset_password = false");
    expect(authApi).not.toContain("markCurrentProfilePasswordResetComplete");
    expect(authApi).not.toMatch(/\.from\(["']profiles["']\)[\s\S]{0,160}\.update\(/);
  });

  it("keeps privileged internal helpers outside the authenticated Data API", () => {
    const internalFunctions = [
      "reset_candidate_document_validation(uuid, uuid, text)",
      "finalize_buk_sync_job_success(uuid, text, jsonb)",
      "finalize_buk_sync_job_existing_active_employee(uuid, text, jsonb)",
      "get_bi_employee_population(text, text[], text[])",
      "prepare_operations_service_entry_batch(jsonb, uuid)",
      "process_pending_approval_reminders()"
    ];

    for (const signature of internalFunctions) {
      expect(migration).toContain(`revoke all on function public.${signature}`);
      expect(migration).toContain("from public, anon, authenticated");
    }
  });

  it("does not provision accounts with a shared password", () => {
    const provisioner = read("scripts/provision-users-from-matrix.mjs");

    expect(provisioner).toContain("crypto.randomBytes(24)");
    expect(provisioner).not.toContain("DEFAULT_PASSWORD");
    expect(provisioner).not.toContain('arg === "--password"');
  });

  it("keeps both Supabase recovery URL formats in recovery mode", () => {
    const authContext = read("src/modules/auth/context/AuthContext.tsx");

    expect(authContext).toContain('queryParams.has("code")');
    expect(authContext).toContain('hashParams.has("access_token")');
    expect(authContext).toContain(
      'event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && detectRecoveryMode())'
    );
  });

  it("does not expose authenticated smoke credentials to pull-request steps", () => {
    const workflow = read(".github/workflows/audit-supabase-migrations.yml");
    const jobEnv = workflow.slice(workflow.indexOf("    env:"), workflow.indexOf("    steps:"));

    expect(jobEnv).not.toContain("secrets.FRONTEND_AUTH_SMOKE");
    expect(workflow).toContain("if: ${{ github.event_name != 'pull_request' }}");
  });
});
