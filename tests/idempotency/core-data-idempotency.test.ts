import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260722183930_core_data_integrity_hardening.sql");

describe("CORE mutation replay safety", () => {
  it("deduplicates hiring and incentive creation by actor and caller key", () => {
    expect(migration).toContain("hiring_requests_requester_idempotency_uidx");
    expect(migration).toContain("hr_incentive_requests_creator_idempotency_uidx");
    expect(migration).toContain("hr.idempotency_key = p_idempotency_key");
    expect(migration).toContain("hir.idempotency_key = p_idempotency_key");
  });

  it("reuses one idempotency key across retries of the same UI submit", () => {
    expect(read("src/modules/recruitment/pages/HiringRequestPage.tsx")).toContain(
      "submitIdempotencyKeyRef.current ??= crypto.randomUUID()"
    );
    expect(read("src/modules/incentives/components/IncentiveRegistrationForm.tsx")).toContain(
      "submitIdempotencyKeyRef.current ??= crypto.randomUUID()"
    );
    expect(read("src/modules/recruitment/services/hiringRequests.ts")).toContain(
      "p_idempotency_key: idempotencyKey"
    );
    expect(read("src/modules/incentives/services/incentivesApi.ts")).toContain(
      "p_idempotency_key: idempotencyKey"
    );
  });

  it("makes closed BUK snapshots immutable and replay-safe", () => {
    expect(migration).toContain("if exists (\n    select 1 from public.buk_employees_daily_snapshot");
    expect(migration).toContain("return 0;");
    expect(migration).toContain("on conflict (snapshot_date, buk_employee_id) do nothing");
    expect(migration).toContain("to service_role;");
  });

  it("does not retry an ambiguous BUK conflict with a second transport", () => {
    const helper = read("supabase/functions/_shared/bukDocuments.ts");
    expect(helper).toContain("BUK_DOCUMENT_UPLOAD_TIMEOUT_MS = 30_000");
    expect(helper).toContain("signal: controller.signal");
    expect(helper).toContain("[400, 415, 422]");
    expect(helper).not.toContain("[400, 409, 415, 422]");
  });

  it("checkpoints each competency artifact before continuing", () => {
    const edge = read("supabase/functions/generate-competency-certificate/index.ts");
    expect(edge).toContain("checkpoint BUK del certificado");
    expect(edge).toContain("checkpoint BUK de la evaluacion");
    expect(edge).toContain("if (!certificateRow.buk_uploaded_at)");
    expect(edge).toContain("if (!evaluationRow.buk_uploaded_at)");
  });

  it("deduplicates accreditation uploads by deterministic operation key", () => {
    const edge = read("supabase/functions/upload-buk-accreditation-document/index.ts");
    expect(edge).toContain("const operationKey = await sha256Hex(");
    expect(edge).toContain('.eq("operation_key", operationKey)');
    expect(edge).toContain('status: "buk_uploaded"');
    expect(edge).toContain("upsert_worker_accreditation_document");
  });
});
