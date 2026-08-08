import { describe, expect, it } from "vitest";
import {
  isValidDsalEmail,
  normalizeDsalDisplayText,
  normalizeDsalEmail,
  normalizeDsalPhone,
  normalizeDsalPhoneDigits
} from "../../src/modules/recruitment/lib/dsalPrecandidateFormatting";

describe("DSAL precandidate formatting", () => {
  it("normalizes free text to ERP-style title case", () => {
    expect(normalizeDsalDisplayText("  juan   pérez DE la cruz ")).toBe("Juan Pérez De La Cruz");
  });

  it("keeps only the eight local mobile digits and builds the canonical phone", () => {
    expect(normalizeDsalPhoneDigits("+56 9 1234-5678")).toBe("12345678");
    expect(normalizeDsalPhone("12345678")).toBe("+56912345678");
    expect(normalizeDsalPhone("1234567")).toBe("");
  });

  it("normalizes email and requires a domain extension", () => {
    expect(normalizeDsalEmail(" PERSONA@EJEMPLO,COM ")).toBe("persona@ejemplo.com");
    expect(isValidDsalEmail("persona@ejemplo.com")).toBe(true);
    expect(isValidDsalEmail("persona-ejemplo.com")).toBe(false);
    expect(isValidDsalEmail("persona@ejemplo")).toBe(false);
  });
});
