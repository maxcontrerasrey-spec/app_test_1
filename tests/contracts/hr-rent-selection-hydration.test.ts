import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/modules/rent_structures/pages/RentStructuresPage.tsx", "utf8");

describe("rent structure selection hydration", () => {
  it("does not hydrate the editor from a previous query result or repeatedly reset the same selection", () => {
    expect(page).toContain("query.isPlaceholderData || hydratedSelectionRef.current === selectionKey");
    expect(page).toContain("hydratedSelectionRef.current = selectionKey");
    expect(page).toContain("query.isPlaceholderData ? <div className=\"rent-empty-panel\" role=\"status\">");
  });
});
