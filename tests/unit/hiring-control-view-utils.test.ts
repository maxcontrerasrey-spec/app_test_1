import { describe, expect, it } from "vitest";
import { formatContractDisplayName } from "../../src/modules/recruitment/lib/contractPresentation";

describe("hiring control view formatting", () => {
  it("removes only a trailing numeric code from the visible contract name", () => {
    expect(formatContractDisplayName("FLIX SANTIAGO (10113)")).toBe("FLIX SANTIAGO");
    expect(formatContractDisplayName("CODELCO ANDINA 2022 (10113)")).toBe("CODELCO ANDINA 2022");
    expect(formatContractDisplayName("Contrato (Norte)")).toBe("Contrato (Norte)");
    expect(formatContractDisplayName(null)).toBe("—");
  });
});
