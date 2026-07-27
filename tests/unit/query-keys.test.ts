import { describe, expect, it } from "vitest";
import { queryKeys } from "../../src/shared/lib/queryKeys";
import { INTERNAL_MOBILITY_CATALOGS_STALE_TIME_MS } from "../../src/modules/internal_mobility/hooks/useInternalMobilityQueries";

describe("queryKeys", () => {
  it("normaliza filtros BI para que el orden de arrays no duplique cache", () => {
    const left = queryKeys.bi.recruitmentDashboard({
      periodCode: " 2026-07 ",
      contractCodes: ["CONT-029", "CONT-028"],
      jobTitles: ["Conductor", "Auxiliar"],
      managementNames: ["Zona II"],
      shiftNames: [" 10X5+5", "7X7 "]
    });
    const right = queryKeys.bi.recruitmentDashboard({
      periodCode: "2026-07",
      contractCodes: ["CONT-028", "CONT-029"],
      jobTitles: ["Auxiliar", "Conductor"],
      managementNames: ["Zona II"],
      shiftNames: ["7X7", "10X5+5"]
    });

    expect(right).toEqual(left);
  });

  it("distingue Jornada en filtros BI para refrescar tarjetas y graficos", () => {
    const withoutShift = queryKeys.bi.recruitmentDashboard({
      periodCode: "202607",
      contractCodes: ["ZONA II CONTRATISTAS"],
      jobTitles: ["Prevencionista de Riesgos"],
      managementNames: ["II: de Antofagasta"]
    });
    const withShift = queryKeys.bi.recruitmentDashboard({
      periodCode: "202607",
      contractCodes: ["ZONA II CONTRATISTAS"],
      jobTitles: ["Prevencionista de Riesgos"],
      managementNames: ["II: de Antofagasta"],
      shiftNames: ["7X7"]
    });

    expect(withShift).not.toEqual(withoutShift);
  });

  it("distingue list/page para evitar reciclar payloads de forma distinta", () => {
    expect(queryKeys.incentives.requestsList({ status: "P" })).not.toEqual(
      queryKeys.incentives.requestsPage({ status: "P" })
    );
  });

  it("expone roots de dominios usados por invalidaciones transversales", () => {
    expect(queryKeys.accreditation.all()).toEqual(["accreditation"]);
    expect(queryKeys.roster.all()).toEqual(["roster"]);
    expect(queryKeys.operationalOnboarding.templateTasks("tpl-1")).toEqual([
      "onboarding_template_tasks",
      "tpl-1"
    ]);
  });

  it("mantiene dinamico el catalogo de folios de movilidad interna", () => {
    expect(queryKeys.internalMobility.setupCatalogs()).toEqual([
      "internal-mobility",
      "setup-catalogs"
    ]);
    expect(INTERNAL_MOBILITY_CATALOGS_STALE_TIME_MS).toBeLessThanOrEqual(20_000);
  });
});
