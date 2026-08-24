import { describe, expect, it } from "vitest";
import {
  certificationState,
  validateDocumentedRules,
  validateRegistry,
  validateSuppressions,
} from "../../scripts/eees-governance-lib.mjs";

describe("EEES 2.0 governance", () => {
  it("detecta IDs duplicados", () => {
    const rule = {
      id: "GOV-001",
      title: "Registro",
      severity: "ERROR",
      scope: "eees",
      source_document: "package.json",
      automatable: true,
      blocking: true,
    };
    expect(validateRegistry([rule, rule]).some((finding) => finding.message === "ID duplicado")).toBe(true);
  });

  it("rechaza una excepcion vencida", () => {
    const findings = validateSuppressions({
      suppressions: [{
        id: "W-1",
        rule_id: "PERF-001",
        scope: "src",
        owner: "Engineering",
        reason: "Deuda",
        risk: "Regresion",
        created_at: "2026-01-01",
        expires_at: "2026-01-02",
        exit_criteria: "Refactor",
      }],
    }, new Date("2026-08-24T00:00:00Z"));
    expect(findings.some((finding) => finding.message.includes("expirada"))).toBe(true);
  });

  it("marca STALE cuando la evidencia no representa HEAD", () => {
    expect(certificationState({
      errors: 0,
      warnings: 0,
      evidenceCommit: "old",
      currentCommit: "head",
      generatedAt: new Date().toISOString(),
    })).toBe("STALE");
  });

  it("un error bloqueante impide certificacion", () => {
    expect(certificationState({
      errors: 1,
      warnings: 0,
      evidenceCommit: "head",
      currentCommit: "head",
      generatedAt: new Date().toISOString(),
    })).toBe("NOT_CERTIFIED");
  });

  it("no deja reglas documentadas fuera del registro", () => {
    expect(validateDocumentedRules([], "eees/books").length).toBeGreaterThan(0);
  });
});
