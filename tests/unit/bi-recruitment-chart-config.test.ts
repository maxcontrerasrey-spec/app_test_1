import { describe, expect, it } from "vitest";
import {
  BI_CHART_PALETTES,
  CANDIDATE_STAGE_ORDER,
  getMobilityStatusColor
} from "../../src/modules/bi/lib/recruitmentAnalyticsChartConfig";

describe("recruitment analytics chart config", () => {
  it("usa rojo opaco especifico para cupos faltantes", () => {
    expect(BI_CHART_PALETTES.light.missingVacancies).toBe("#b95a4f");
    expect(BI_CHART_PALETTES.light.missingVacancies).not.toBe(BI_CHART_PALETTES.light.pending);
  });

  it("diferencia pendientes de movilidad interna por criterio operativo", () => {
    const palette = BI_CHART_PALETTES.light;

    expect(getMobilityStatusColor("Pendiente ejecución RRHH", palette)).toBe(palette.mobility);
    expect(getMobilityStatusColor("Pendiente control contratos", palette)).toBe(
      palette.mobilityPendingControl
    );
    expect(getMobilityStatusColor("Pendiente ejecución RRHH", palette)).not.toBe(
      getMobilityStatusColor("Pendiente control contratos", palette)
    );
  });

  it("ordena levantamiento de contraindicacion entre examenes y documental", () => {
    expect(CANDIDATE_STAGE_ORDER).toEqual([
      "Lead",
      "Who pendiente",
      "Who aprobado",
      "En proceso",
      "Exámenes médicos",
      "Levantamiento de Contraindicación",
      "Revisión documental",
      "Listos para contratar"
    ]);
  });
});
