import { describe, expect, it } from "vitest";
import {
  buildEmptyWhoCauseDrafts,
  isWhoCauseDraftComplete,
  isWhoCauseDraftStarted
} from "../../src/modules/recruitment/lib/whoCauseDrafts";

describe("whoCauseDrafts", () => {
  it("crea cuatro borradores independientes para causas WHO", () => {
    const drafts = buildEmptyWhoCauseDrafts();
    drafts[0].comment = "Observacion";

    expect(drafts).toHaveLength(4);
    expect(drafts[1].comment).toBe("");
  });

  it("distingue borrador iniciado de borrador completo", () => {
    expect(isWhoCauseDraftStarted({ type: "", year: "2026", comment: "" })).toBe(true);
    expect(isWhoCauseDraftComplete({ type: "", year: "2026", comment: "Falta doc" })).toBe(false);
    expect(
      isWhoCauseDraftComplete({
        type: "documentacion" as never,
        year: "2026",
        comment: "Falta doc"
      })
    ).toBe(true);
  });
});
