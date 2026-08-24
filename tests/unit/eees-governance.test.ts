import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  certificationState,
  isCertificationPassingState,
  validateDocumentedRules,
  validateGates,
  validateRegistry,
  validateSuppressions,
} from "../../scripts/eees-governance-lib.mjs";
import { auditChangedMigrations, auditMigrationSql } from "../../scripts/audit-eees-migrations.mjs";
import { scanSecretContent } from "../../scripts/audit-eees-secrets.mjs";

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
    expect(isCertificationPassingState("STALE")).toBe(false);
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

  it("un warning no aceptado impide certificacion", () => {
    expect(certificationState({
      errors: 0,
      unresolvedWarnings: 1,
      acceptedRisks: 0,
      evidenceCommit: "head",
      currentCommit: "head",
      generatedAt: new Date().toISOString(),
    })).toBe("NOT_CERTIFIED");
  });

  it("solo una excepcion gobernada produce riesgo aceptado", () => {
    expect(certificationState({
      errors: 0,
      unresolvedWarnings: 0,
      acceptedRisks: 1,
      evidenceCommit: "head",
      currentCommit: "head",
      generatedAt: new Date().toISOString(),
    })).toBe("CERTIFIED_WITH_ACCEPTED_RISK");
  });

  it("no deja reglas documentadas fuera del registro", () => {
    expect(validateDocumentedRules([], "eees/books").length).toBeGreaterThan(0);
  });

  it("no deja una regla automatizable bloqueante sin gate", () => {
    const rules = [{
      id: "GOV-001",
      classification: "governance",
      status: "active",
      automatable: true,
      blocking: true,
    }];
    expect(validateGates({ gates: [] }, rules).some((finding) => finding.message.includes("sin gate"))).toBe(true);
  });

  it("rechaza supresiones duplicadas y reglas inexistentes", () => {
    const suppression = {
      id: "W-1",
      rule_id: "PERF-999",
      scope: "src",
      owner: "Engineering",
      reason: "Deuda",
      risk: "Regresion",
      created_at: "2026-08-24",
      expires_at: "2026-09-24",
      exit_criteria: "Refactor",
    };
    const findings = validateSuppressions(
      { suppressions: [suppression, suppression] },
      new Date("2026-08-24T00:00:00Z"),
      [{ id: "PERF-003", status: "active" }],
    );
    expect(findings.some((finding) => finding.message.includes("duplicada"))).toBe(true);
    expect(findings.some((finding) => finding.message.includes("inexistente"))).toBe(true);
  });

  it("detecta operaciones destructivas ampliadas y exige cabecera estructurada", () => {
    expect(auditMigrationSql("DROP POLICY read_all ON public.items;")).toHaveLength(1);
    expect(auditMigrationSql(`
-- EEES-DB-005: approved
-- owner: Database Platform
-- rollback: recrear policy read_all desde revision anterior
DROP POLICY read_all ON public.items;
    `)).toHaveLength(0);
  });

  it("compara la migracion comprometida contra el SHA base en un checkout limpio", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eees-migration-"));
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.email", "eees@example.invalid"], { cwd: root });
    execFileSync("git", ["config", "user.name", "EEES Test"], { cwd: root });
    fs.mkdirSync(path.join(root, "supabase/migrations"), { recursive: true });
    fs.writeFileSync(path.join(root, "README.md"), "baseline\n");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-qm", "baseline"], { cwd: root });
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    fs.writeFileSync(path.join(root, "supabase/migrations/20260824000100_drop.sql"), "DROP TABLE public.critical_data;\n");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-qm", "destructive"], { cwd: root });

    const result = auditChangedMigrations({ root, env: { CI: "true", EEES_BASE_SHA: base, EEES_HEAD_SHA: "HEAD" } });
    expect(result.files).toEqual(["supabase/migrations/20260824000100_drop.sql"]);
    expect(result.findings).toHaveLength(1);
  });

  it("detecta credenciales modernas sin exponer su valor", () => {
    const openAi = ["sk", "proj", "A".repeat(32)].join("-");
    const supabase = `sb_secret_${"B".repeat(32)}`;
    expect(scanSecretContent(`${openAi}\n${supabase}`)).toEqual(expect.arrayContaining(["OpenAI API key", "Supabase secret key"]));
  });

  it("certifica solo despues del build y sin filtros parciales de paths", () => {
    const workflow = fs.readFileSync(".github/workflows/audit-supabase-migrations.yml", "utf8");
    expect(workflow).not.toContain("    paths:");
    expect(workflow.indexOf("run: npm run eees:certify")).toBeGreaterThan(workflow.indexOf("run: npm run build"));
    expect(workflow.indexOf("run: npm run eees:status")).toBeGreaterThan(workflow.indexOf("run: npm run eees:certify"));
  });
});
