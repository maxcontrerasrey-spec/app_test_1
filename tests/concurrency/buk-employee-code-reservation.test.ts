import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260806205622_prevent_false_buk_employee_codes.sql"
  ),
  "utf8"
);
const edgeFunction = fs.readFileSync(
  path.join(root, "supabase/functions/sync-buk-candidates/index.ts"),
  "utf8"
);

function extractFunction(functionName: string) {
  const pattern = new RegExp(
    `create or replace function ${functionName.replaceAll(".", "\\.")}\\([\\s\\S]*?\\n\\$function\\$;`,
    "i"
  );
  return migration.match(pattern)?.[0] ?? "";
}

describe("BUK employee code reservations", () => {
  it("reserves one active sequence per normalized identity under an advisory lock", () => {
    expect(migration).toContain("private.buk_employee_code_reservations");
    expect(migration).toContain("uq_buk_employee_code_reservations_active_code");
    expect(migration).toContain("where status <> 'released'");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock(");
    expect(migration).toContain("'buk-sheet:' || normalized_identity");
  });

  it("never uses a worker file or historical job snapshot as the authoritative sequence", () => {
    const resolver = extractFunction("public.resolve_candidate_worker_employee_code");
    expect(resolver).not.toBe("");
    expect(resolver).not.toContain("payload_snapshot");
    expect(resolver).not.toContain("candidate_worker_files");
    expect(resolver).toContain("private.buk_employee_code_reservations");
    expect(resolver).toContain("public.employees");
  });

  it("freezes the reservation on every job and removes direct authenticated resolver access", () => {
    expect(migration).toContain("trg_buk_sync_jobs_reserve_employee_code");
    expect(migration).toContain("'{profile,reserved_employee_code}'");
    expect(migration).toMatch(
      /revoke all on function public\.resolve_candidate_worker_employee_code\(uuid\)[\s\S]*?from public, anon, authenticated, service_role;/
    );
  });

  it("reconciles against live BUK and verifies code_sheet before plan, job or finalization", () => {
    const preflightCall = edgeFunction.lastIndexOf(
      "await reconcileBukEmployeeCodeBeforeWrite("
    );
    const employeeWrite = edgeFunction.lastIndexOf(
      "await resolveBukEmployeeForSync(payload, locations)"
    );
    const confirmation = edgeFunction.lastIndexOf(
      "await verifyAndConfirmBukEmployeeCode("
    );
    const setup = edgeFunction.lastIndexOf(
      "await ensureBukEmployeeSetup(supabase, payload, employeeId)"
    );

    expect(preflightCall).toBeGreaterThan(-1);
    expect(preflightCall).toBeLessThan(employeeWrite);
    expect(confirmation).toBeGreaterThan(employeeWrite);
    expect(confirmation).toBeLessThan(setup);
  });
});
