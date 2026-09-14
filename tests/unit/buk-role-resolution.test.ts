import { describe, expect, it } from "vitest";
import {
  filterExactBukRolesByName,
  parseBukRoleIdFromJobPositionCode,
  selectExactBukRoleForArea
} from "../../supabase/functions/_shared/bukRoleResolution";

const roles = [
  { id: 81, name: "ADM. VENTAS VILLA ALEMANA", area_ids: [408, 481] },
  { id: 82, name: "ADM. VENTAS LOS ANDES", area_ids: [457, 481] },
  { id: 14, name: "PREVENCIONISTA DE RIESGOS", area_ids: [408] },
  { id: 167, name: "PREVENCIONISTA DE RIESGOS", area_ids: [457] }
];

describe("BUK role resolution", () => {
  it("preserves the stable BUK role id encoded by the live catalog", () => {
    expect(parseBukRoleIdFromJobPositionCode("BUK-ROLE-82")).toBe(82);
    expect(parseBukRoleIdFromJobPositionCode("CARGO-082")).toBeNull();
  });

  it("never treats a similar role name as an exact candidate", () => {
    expect(filterExactBukRolesByName("ADM. VENTAS LOS ANDES", roles)).toEqual([roles[1]]);
    expect(selectExactBukRoleForArea("ADM. VENTAS LOS ANDES", 408, 82, roles).status).toBe("not_found");
  });

  it("resolves duplicate exact names by area without changing the requested title", () => {
    const resolution = selectExactBukRoleForArea(
      "PREVENCIONISTA DE RIESGOS",
      457,
      14,
      roles
    );

    expect(resolution.status).toBe("resolved");
    expect(resolution.role?.id).toBe(167);
  });

  it("rejects multiple exact roles in the same area when the preferred id cannot disambiguate", () => {
    const ambiguous = [
      { id: 14, name: "PREVENCIONISTA DE RIESGOS", area_ids: [408] },
      { id: 167, name: "PREVENCIONISTA DE RIESGOS", area_ids: [408] }
    ];

    expect(
      selectExactBukRoleForArea("PREVENCIONISTA DE RIESGOS", 408, 999, ambiguous).status
    ).toBe("ambiguous");
  });
});
