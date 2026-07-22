import { describe, expect, it } from "vitest";
import { queryKeys } from "../../src/shared/lib/queryKeys";

describe("queryKeys", () => {
  it("normaliza filtros BI para que el orden de arrays no duplique cache", () => {
    const left = queryKeys.bi.recruitmentDashboard({
      periodCode: " 2026-07 ",
      contractCodes: ["CONT-029", "CONT-028"],
      jobTitles: ["Conductor", "Auxiliar"],
      managementNames: ["Zona II"]
    });
    const right = queryKeys.bi.recruitmentDashboard({
      periodCode: "2026-07",
      contractCodes: ["CONT-028", "CONT-029"],
      jobTitles: ["Auxiliar", "Conductor"],
      managementNames: ["Zona II"]
    });

    expect(right).toEqual(left);
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
});
