import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("supabase/functions/sync-buk-candidates/index.ts", "utf8");

describe("BUK exact role guard", () => {
  it("does not keep the former fuzzy role scoring path", () => {
    expect(worker).not.toContain("scoreBukRoleCandidate");
    expect(worker).toContain("selectExactBukRoleForArea");
    expect(worker).toContain("parseBukRoleIdFromJobPositionCode");
  });

  it("resolves contract and role before any employee reservation or BUK write", () => {
    const loopStart = worker.indexOf("for (const job of jobs)");
    const preflight = worker.indexOf("const syncContext = await resolveCandidateSyncContext", loopStart);
    const reservation = worker.indexOf("const employeeCodePreflight = await reconcileBukEmployeeCodeBeforeWrite", loopStart);
    const employeeWrite = worker.indexOf("const resolvedEmployee = await resolveBukEmployeeForSync", loopStart);

    expect(loopStart).toBeGreaterThan(-1);
    expect(preflight).toBeGreaterThan(loopStart);
    expect(reservation).toBeGreaterThan(preflight);
    expect(employeeWrite).toBeGreaterThan(preflight);
  });
});
