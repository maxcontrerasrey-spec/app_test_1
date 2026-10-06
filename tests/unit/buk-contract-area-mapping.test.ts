import { describe, expect, it } from "vitest";
import { findExactBukAreaMappings, isExactBukContractAreaMatch, type BukContractAreaMapping } from "../../supabase/functions/_shared/bukContractAreaMapping";

const mapping: BukContractAreaMapping = {
  contract_id: 45,
  buk_area_name: "FLIX LA SERENA",
  buk_area_code: "535",
  contract_number: "7776182302:0001"
};

const areas = [
  { id: 1160, name: "FLIX LA SERENA", second_level_name: "FLIX LA SERENA", cost_center: null },
  { id: 1163, name: "7776182302:0006", second_level_name: "FLIX LA SERENA", cost_center: "662" },
  { id: 997, name: "7776182302:0001", second_level_name: "FLIX LA SERENA", cost_center: "535" }
];

describe("BUK contract-to-area mapping", () => {
  it("maps a job only to the exact operational cost center", () => {
    expect(isExactBukContractAreaMatch(mapping, areas[2], areas, 1)).toBe(true);
  });

  it("trusts the exact cost center when BUK exposes a different display subarea number", () => {
    const legacyMapping = {
      contract_id: 27,
      buk_area_name: "CODELCO ANDINA 2022",
      buk_area_code: "700",
      contract_number: "6170400008:0001"
    };
    const area = {
      id: 736,
      name: "6170400008:0005",
      second_level_name: "CODELCO ANDINA 2022",
      cost_center: "700"
    };
    expect(isExactBukContractAreaMatch(legacyMapping, area, [area], 1)).toBe(true);
  });

  it("rejects a same-name parent area without the mapped cost center", () => {
    expect(isExactBukContractAreaMatch(mapping, areas[0], areas, 1)).toBe(false);
  });

  it("rejects a same-name subarea belonging to another contract", () => {
    expect(isExactBukContractAreaMatch(mapping, areas[1], areas, 1)).toBe(false);
  });

  it("fails closed when a legacy name-only mapping matches multiple BUK areas", () => {
    const legacyMapping = { contract_id: 45, buk_area_name: "FLIX LA SERENA" };
    expect(isExactBukContractAreaMatch(legacyMapping, areas[0], areas, 1)).toBe(false);
  });

  it("allows a legacy name-only mapping only when both sides are unique", () => {
    const uniqueArea = [{ id: 40, name: "OPERACION NORTE", cost_center: "100" }];
    const legacyMapping = { contract_id: 46, buk_area_name: "OPERACION NORTE" };
    expect(isExactBukContractAreaMatch(legacyMapping, uniqueArea[0], uniqueArea, 1)).toBe(true);
    expect(isExactBukContractAreaMatch(legacyMapping, uniqueArea[0], uniqueArea, 2)).toBe(false);
  });

  it("preserves a stale numeric code only when the display label is unique", () => {
    const uniqueArea = [{ id: 40, name: "OPERACION NORTE", cost_center: "100" }];
    const legacyMapping = {
      contract_id: 46,
      buk_area_name: "OPERACION NORTE",
      buk_area_code: "999",
      contract_number: "OPERACION-1"
    };
    expect(isExactBukContractAreaMatch(legacyMapping, uniqueArea[0], uniqueArea, 1)).toBe(true);
    expect(isExactBukContractAreaMatch(legacyMapping, uniqueArea[0], uniqueArea, 2)).toBe(false);
  });

  it("uses a formatted BUK subarea identifier only as an exact identifier", () => {
    const identifiedMapping = { ...mapping, buk_area_code: "7776182302:0001" };
    expect(isExactBukContractAreaMatch(identifiedMapping, areas[2], areas, 1)).toBe(true);
    expect(isExactBukContractAreaMatch(identifiedMapping, areas[1], areas, 1)).toBe(false);
  });

  it("continues to a precise parent label when a preceding same-name mapping fails exact validation", () => {
    const area = {
      id: 997,
      name: "AREA OPERATIVA",
      second_level_name: "FLIX LA SERENA",
      cost_center: "535"
    };
    const mappingsByLabel = new Map<string, BukContractAreaMapping[]>([
      ["area operativa", [
        { contract_id: 90, buk_area_name: "AREA OPERATIVA", buk_area_code: "999" },
        { contract_id: 91, buk_area_name: "AREA OPERATIVA", buk_area_code: "998" }
      ]],
      ["flix la serena", [mapping]]
    ]);

    expect(findExactBukAreaMappings(
      [area.name, area.second_level_name],
      mappingsByLabel,
      area,
      [area]
    )).toEqual([mapping]);
  });
});
