import { describe, expect, it } from "vitest";
import { formatOpenDuration } from "../../src/modules/recruitment/lib/openDuration";

describe("formatOpenDuration", () => {
  const referenceDate = new Date("2026-07-23T12:00:00-04:00");

  it("formatea años, meses y días calendario desde la apertura del folio", () => {
    expect(formatOpenDuration("2024-05-20T09:30:00-04:00", referenceDate)).toBe(
      "2 años 2 meses 3 días"
    );
  });

  it("omite unidades en cero y mantiene días para procesos recién abiertos", () => {
    expect(formatOpenDuration("2026-06-23T08:00:00-04:00", referenceDate)).toBe("1 mes");
    expect(formatOpenDuration("2026-07-22T08:00:00-04:00", referenceDate)).toBe("1 día");
    expect(formatOpenDuration("2026-07-23T08:00:00-04:00", referenceDate)).toBe("0 días");
  });

  it("maneja valores sin fecha autoritativa", () => {
    expect(formatOpenDuration(null, referenceDate)).toBe("No disponible");
    expect(formatOpenDuration("fecha-invalida", referenceDate)).toBe("No disponible");
  });
});
