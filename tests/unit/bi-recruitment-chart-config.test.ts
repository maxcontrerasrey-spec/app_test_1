import { describe, expect, it } from "vitest";
import {
  BI_CHART_PALETTES,
  CANDIDATE_STAGE_ORDER,
  RECRUITMENT_DONUT_CHART_STYLE,
  getMobilityStatusColor,
  truncateRecruitmentChartLabel
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

  it("homologa las donas de reclutamiento al estilo visual de incentivos", () => {
    expect(RECRUITMENT_DONUT_CHART_STYLE).toMatchObject({
      radius: ["50%", "75%"],
      center: ["50%", "45%"],
      padAngle: 3,
      labelMaxLength: 16
    });
  });

  it("trunca labels de dona para no saturar el grafico", () => {
    expect(truncateRecruitmentChartLabel("Pendiente control contratos")).toBe("Pendiente contro…");
    expect(truncateRecruitmentChartLabel("Ejecutadas")).toBe("Ejecutadas");
  });
});
