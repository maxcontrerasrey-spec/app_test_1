import { describe, expect, it } from "vitest";
import { formatClpInputValue, parseClpInputValue } from "../../src/modules/rent_structures/lib/rentAmountInput";

describe("entrada de montos CLP", () => {
  it("deja vacío el valor cero para permitir escribir sin reposicionar el cursor", () => {
    expect(formatClpInputValue(0)).toBe("");
    expect(parseClpInputValue("")).toBe(0);
  });

  it("separa miles y millones con puntos mientras conserva el valor numérico", () => {
    expect(formatClpInputValue(1_000)).toBe("1.000");
    expect(formatClpInputValue(1_444_115)).toBe("1.444.115");
    expect(parseClpInputValue("1.444.115")).toBe(1_444_115);
  });

  it("normaliza montos pegados con símbolos y espacios", () => {
    expect(parseClpInputValue("$ 1.234.567")).toBe(1_234_567);
    expect(formatClpInputValue(parseClpInputValue("$ 1.234.567"))).toBe("1.234.567");
  });
});
