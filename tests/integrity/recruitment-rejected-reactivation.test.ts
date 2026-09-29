import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const addCandidateService = read("src/modules/recruitment/services/hiringControl.ts");
const modal = read("src/modules/recruitment/components/TransferCandidateModal.tsx");
const sidebar = read("src/modules/recruitment/components/CandidateDetailSidebar.tsx");
const filters = read("src/modules/recruitment/components/hiringControlViewUtils.ts");

describe("rejected candidate reactivation contract", () => {
  it("reuses the authorized candidate intake path for a new or existing folio", () => {
    expect(addCandidateService).toContain('supabase.rpc("add_candidate_to_recruitment_case"');
    expect(modal).toContain("addCandidateToRecruitmentCase");
    expect(modal).toContain('candidate?.stage_code === "rejected"');
    expect(modal).toContain('candidate?.stage_code === "withdrawn"');
    expect(modal).toContain("Reactivar candidato");
  });

  it("keeps Sin Folio as the terminal-safe reactivation path", () => {
    expect(modal).toContain("releaseCandidateWithoutFolio");
    expect(modal).toContain("dejarlo disponible en");
    expect(sidebar).toContain('selectedCandidate.stage_code !== "hired"');
    expect(sidebar).toContain('selectedCandidate.stage_code === "rejected"');
  });

  it("makes rejected candidates discoverable without changing rejection semantics", () => {
    expect(filters).toContain('key: "discarded", label: "Rechazados / desistidos"');
  });
});
