import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260911113000_require_bank_details_for_buk_transfers.sql",
  "utf8"
);
const workerRules = readFileSync(
  "src/modules/recruitment/lib/candidateBukWorkerRules.ts",
  "utf8"
);
const bukWorker = readFileSync("supabase/functions/sync-buk-candidates/index.ts", "utf8");

describe("BUK bank account guards", () => {
  it("enforces transfer bank details in worker files and queued snapshots", () => {
    expect(migration).toContain("validate_candidate_worker_file_bank_account");
    expect(migration).toContain("validate_buk_sync_job_bank_account_payload");
    expect(migration).toContain("bank_account_number");
  });

  it("keeps frontend and worker defenses aligned", () => {
    expect(workerRules).toContain("paymentMethodRequiresBankAccount");
    expect(bukWorker.match(/assertBukBankAccountIsComplete\(worker\)/g)).toHaveLength(2);
  });
});
