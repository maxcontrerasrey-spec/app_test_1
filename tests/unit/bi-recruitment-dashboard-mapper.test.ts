import { describe, expect, it } from "vitest";
import { formatAverageHiringDuration } from "../../src/modules/bi/components/BiRecruitmentAnalyticsView";
import { mapRecruitmentDashboard } from "../../src/modules/bi/services/biApi";

describe("mapRecruitmentDashboard", () => {
  it("mapea el tiempo medio de contratacion cuando el RPC lo entrega", () => {
    const dashboard = mapRecruitmentDashboard({
      summary: {
        requestedVacancies: 4,
        filledVacancies: 2,
        averageHiringDays: "12.5"
      }
    });

    expect(dashboard.summary.averageHiringDays).toBe(12.5);
  });

  it("conserva null cuando no hay contrataciones para el filtro seleccionado", () => {
    const dashboard = mapRecruitmentDashboard({
      summary: {
        requestedVacancies: 4,
        filledVacancies: 0,
        averageHiringDays: null
      }
    });

    expect(dashboard.summary.averageHiringDays).toBeNull();
  });
});

describe("formatAverageHiringDuration", () => {
  it("formatea dias promedio como años, meses y dias omitiendo unidades en cero", () => {
    expect(formatAverageHiringDuration(99.1)).toBe("3 meses 9 días");
    expect(formatAverageHiringDuration(395)).toBe("1 año 1 mes");
    expect(formatAverageHiringDuration(12)).toBe("12 días");
    expect(formatAverageHiringDuration(null)).toBe("Sin datos");
  });
});
