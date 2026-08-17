import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read(
  "supabase/migrations/20260817180000_add_competency_legal_signature_workflow.sql"
);
const generator = read("supabase/functions/generate-competency-certificate/index.ts");
const approvalApi = read("src/modules/competencies/services/competencyLegalApprovalApi.ts");
const approvalPanel = read(
  "src/modules/competencies/components/CompetencyCertificateSummaryPanel.tsx"
);
const competencyTypes = read("src/modules/competencies/types.ts");

describe("Competency legal signature contract", () => {
  it("keeps DSAL scope, signer authorization and pending-only approval at the database boundary", () => {
    expect(migration).toContain("competency_requires_legal_signature");
    expect(migration).toContain("6170400011:0001");
    expect(migration).toContain("Guillermo Zañartu Apara");
    expect(migration).toContain("user_can_approve_competency_legal_signature");
    expect(migration).toContain("legal_approval_status = 'pending'");
    expect(migration).toContain("revoke all on public.competency_legal_signers from public, anon, authenticated");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("requires approved legal signature before PDF generation and resolves RUN from BUK", () => {
    const approvalGuard = generator.indexOf(
      "El certificado de Codelco El Salvador debe ser aprobado"
    );
    const signerLookup = generator.indexOf("from(\"competency_legal_signers\")");
    const bukLookup = generator.indexOf("from(\"employees_active_current\")", signerLookup);
    const claim = generator.indexOf("claim_competency_certificate_generation");

    expect(approvalGuard).toBeGreaterThan(0);
    expect(signerLookup).toBeGreaterThan(approvalGuard);
    expect(bukLookup).toBeGreaterThan(signerLookup);
    expect(claim).toBeGreaterThan(bukLookup);
    expect(generator).toContain("No fue posible resolver el RUN de Guillermo Zañartu Apara desde BUK");
    expect(generator).toContain("guillermo-zanartu-apara.png");
    expect(generator).toContain("legal_signature_sha256");
    expect(generator).toContain("legal_signature_signed_at");
  });

  it("connects the restricted approval RPCs to the compact ERP review panel", () => {
    expect(approvalApi).toContain("fetchCompetencyLegalApprovalQueue");
    expect(approvalApi).toContain("decide_competency_legal_approval");
    expect(approvalPanel).toContain("Aprobaciones Representante Legal");
    expect(approvalPanel).toContain("decideCompetencyLegalApproval");
    expect(competencyTypes).toContain("legalApprovalStatus");
  });
});
