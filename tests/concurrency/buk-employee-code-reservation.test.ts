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
const reentryMigration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260825131618_harden_buk_reentry_employee_code_checkpoint.sql"
  ),
  "utf8"
);
const edgeFunction = fs.readFileSync(
  path.join(root, "supabase/functions/sync-buk-candidates/index.ts"),
  "utf8"
);
const candidateJobRunner = fs.readFileSync(
  path.join(root, "scripts/process-buk-candidate-jobs.mjs"),
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

  it("hydrates summary matches and preserves the document-query evidence before resolving an inactive employee", () => {
    const lookupStart = edgeFunction.indexOf(
      "async function lookupBukEmployeesByDocumentNumber"
    );
    const lookupEnd = edgeFunction.indexOf(
      "function applyReservedBukEmployeeCode",
      lookupStart
    );
    const lookup = edgeFunction.slice(lookupStart, lookupEnd);

    expect(lookup).toContain("await fetchBukEmployeeById(String(employee.id))");
    expect(lookup).toContain("document_query_identity: queriedDocumentNumber");
    expect(lookup).toContain("identity_hydrated: true");
    expect(edgeFunction).toContain(
      "employee.document_query_identity === targetDocumentNumber"
    );
    expect(edgeFunction).toContain(
      "hasExplicitMatchingBukEmployeeContact(employee, payload)"
    );
    expect(edgeFunction).toContain("matchesBukEmployeeName(employee, payload)");
    expect(edgeFunction).toContain(
      'normalizeBukDocumentNumber as normalizeDocumentNumber'
    );
  });

  it("uses the atomic reservation as the clone code instead of recalculating the correlativo", () => {
    const clonePayloadStart = edgeFunction.indexOf(
      "function buildBukEmployeeClonePayload"
    );
    const clonePayloadEnd = edgeFunction.indexOf(
      "async function createBukEmployee",
      clonePayloadStart
    );
    const clonePayload = edgeFunction.slice(clonePayloadStart, clonePayloadEnd);

    expect(clonePayload).toContain(
      "code_sheet: resolveBukEmployeeCode(payload) ?? resolveNextBukEmployeeCode(payload, employees)"
    );
    expect(clonePayload.indexOf("resolveBukEmployeeCode(payload)")).toBeLessThan(
      clonePayload.indexOf("resolveNextBukEmployeeCode(payload, employees)")
    );
  });

  it("checkpoints the returned BUK id before code confirmation and setup", () => {
    const checkpoint = edgeFunction.lastIndexOf("await checkpointBukEmployeeCode(");
    const confirmation = edgeFunction.lastIndexOf(
      "await verifyAndConfirmBukEmployeeCode("
    );
    const setup = edgeFunction.lastIndexOf(
      "await ensureBukEmployeeSetup(supabase, payload, employeeId)"
    );

    expect(checkpoint).toBeGreaterThan(-1);
    expect(checkpoint).toBeLessThan(confirmation);
    expect(confirmation).toBeLessThan(setup);
    expect(reentryMigration).toContain(
      "checkpoint_buk_employee_code_reservation"
    );
    expect(reentryMigration).toContain("'{employeeCheckpoint}'");
  });

  it("recognizes a reserved partial clone across a newly enqueued job", () => {
    const preflightStart = edgeFunction.indexOf(
      "async function reconcileBukEmployeeCodeBeforeWrite"
    );
    const preflightEnd = edgeFunction.indexOf(
      "async function checkpointBukEmployeeCode",
      preflightStart
    );
    const preflight = edgeFunction.slice(preflightStart, preflightEnd);

    expect(preflight).toContain("wasCreatedAfterReservation");
    expect(preflight).not.toContain("job.attempts > 1");
    expect(preflight).toContain("employeesUsingReservedCode.length > 0");
  });

  it("enforces one pending reentry per identity and one reservation per BUK employee", () => {
    expect(reentryMigration).toContain(
      "uq_buk_employee_code_reservations_one_pending_identity"
    );
    expect(reentryMigration).toContain("where status = 'reserved'");
    expect(reentryMigration).toContain(
      "uq_buk_employee_code_reservations_employee"
    );
    expect(reentryMigration).toContain(
      "where buk_employee_id is not null and status <> 'released'"
    );
  });

  it("keeps the highest historical ficha as predecessor and blocks any active RUT", () => {
    expect(reentryMigration).toContain("predecessor_buk_employee_id");
    expect(reentryMigration).toContain("predecessor_employee_code");
    expect(reentryMigration).toContain("::integer desc");
    expect(edgeFunction).toContain(
      "payload.employee_code_reservation?.predecessor_buk_employee_id"
    );

    const duplicateStart = edgeFunction.indexOf(
      "function isActiveBukEmployeeDuplicate"
    );
    const duplicateEnd = edgeFunction.indexOf(
      "function isErpProvisionedActiveBukEmployee",
      duplicateStart
    );
    const duplicateRule = edgeFunction.slice(duplicateStart, duplicateEnd);
    expect(duplicateRule).toContain(
      'resolveBukEmployeeStatus(employee) === "active"'
    );
    expect(duplicateRule).toContain("matchesBukEmployeeDocument(employee, payload)");
    expect(duplicateRule).not.toContain("active_since");
  });

  it("requires a terminal success with a BUK employee id in the audited runner", () => {
    expect(candidateJobRunner).toContain('row.status !== "success"');
    expect(candidateJobRunner).toContain("row.buk_employee_id");
    expect(candidateJobRunner).toContain("jobIds.length > 20");
    expect(candidateJobRunner).not.toContain("console.log(serviceRoleKey)");
  });
});
