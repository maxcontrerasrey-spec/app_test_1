import { describe, expect, it } from "vitest";
import { normalizeBukDocumentNumber } from "../../supabase/functions/_shared/bukIdentity";

describe("BUK employee identity", () => {
  it("normalizes formatted RUT values and the verifier K without case differences", () => {
    expect(normalizeBukDocumentNumber("RUT", "11.692.837-K")).toBe("11692837K");
    expect(normalizeBukDocumentNumber("rut", "11.692.837-k")).toBe("11692837K");
    expect(normalizeBukDocumentNumber("Rut", "11692837k")).toBe("11692837K");
  });

  it("keeps non-RUT documents trimmed and case-insensitive", () => {
    expect(normalizeBukDocumentNumber("Pasaporte", "  ab12345  ")).toBe("AB12345");
    expect(normalizeBukDocumentNumber("RUT", null)).toBe("");
  });
});
