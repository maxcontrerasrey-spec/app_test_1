import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Accreditation UI contracts", () => {
  it("keeps the module navigation and worker workspace scoped to the compact surface", () => {
    const page = readSource("src/modules/accreditation/pages/AccreditationPage.tsx");
    const workers = readSource("src/modules/accreditation/components/AccreditationWorkersView.tsx");

    expect(page).toContain('<PageShell className="accreditation-page">');
    expect(page).toContain('className="approval-chip-row accreditation-view-tabs"');
    expect(workers).toContain('className="accreditation-card-heading"');
    expect(workers).toContain('className="accreditation-empty-detail"');
    expect(workers).toContain("formatAccreditationStatus");
  });

  it("uses flat rows, bounded lists and responsive columns", () => {
    const styles = readSource("src/modules/accreditation/styles/accreditation.css");

    expect(styles).toContain("grid-template-columns: minmax(0, 1.12fr) minmax(340px, 0.88fr);");
    expect(styles).toContain("align-items: start;");
    expect(styles).toContain("max-height: min(64vh, 41rem);");
    expect(styles).toContain("border-bottom: 1px solid var(--border-subtle);");
    expect(styles).toContain("border-radius: 0;");
    expect(styles).toContain("@media (max-width: 1180px)");
    expect(styles).toContain("@media (max-width: 768px)");
  });
});
