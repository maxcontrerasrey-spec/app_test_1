type BukRecord = Record<string, unknown>;

export type BukContractAreaMapping = {
  contract_id: number;
  buk_area_name: string;
  buk_area_code?: string | null;
  contract_number?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function readText(record: BukRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  }

  return "";
}

function normalizeAreaLabel(value: string) {
  return normalizeText(value).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function areaLabels(area: BukRecord) {
  const parent = area.parent_area;
  const parentRecord = parent && typeof parent === "object" && !Array.isArray(parent)
    ? parent as BukRecord
    : null;

  return [
    readText(area, ["name", "area_name"]),
    readText(area, ["second_level_name", "department_name"]),
    parentRecord ? readText(parentRecord, ["name", "area_name"]) : ""
  ].map(normalizeAreaLabel).filter(Boolean);
}

function isAreaActive(area: BukRecord) {
  const active = area.active ?? area.is_active ?? area.enabled;
  if (typeof active === "boolean") return active;

  const status = normalizeText(readText(area, ["status", "estado", "active", "is_active"]));
  return !["inactive", "inactivo", "disabled", "deshabilitado", "archived"].includes(status);
}

function directAreaIdentifiers(area: BukRecord) {
  return [
    readText(area, ["name", "area_name"]),
    readText(area, ["code", "area_code", "contract_number"])
  ].map(normalizeText).filter(Boolean);
}

function hasUniqueAreaLabel(area: BukRecord, label: string, allAreas: BukRecord[]) {
  const areaId = readText(area, ["id", "area_id"]);
  const matches = allAreas.filter((candidate) =>
    isAreaActive(candidate) && areaLabels(candidate).includes(label)
  );

  return matches.length === 1 && readText(matches[0], ["id", "area_id"]) === areaId;
}

/**
 * Resolves an ERP contract to the exact operational BUK area. Display labels
 * are only a fallback when they uniquely identify both the local mapping and
 * one active BUK area; otherwise an explicit area/cost-center identifier is
 * required.
 */
export function isExactBukContractAreaMatch(
  mapping: BukContractAreaMapping,
  area: BukRecord,
  allAreas: BukRecord[],
  sameLabelMappingCount: number
) {
  const label = normalizeAreaLabel(mapping.buk_area_name);
  if (!label || !areaLabels(area).includes(label)) return false;

  const areaCode = mapping.buk_area_code?.trim() ?? "";
  const contractNumber = mapping.contract_number?.trim() ?? "";
  const exactContractNumber = /^\d+:\d+$/.test(contractNumber);

  if (/^\d+:\d+$/.test(areaCode)) {
    return directAreaIdentifiers(area).includes(normalizeText(areaCode));
  }

  if (areaCode) {
    const costCenter = readText(area, ["cost_center", "cost_center_code", "costCenter"]);
    const areaId = readText(area, ["id", "area_id"]);
    if (normalizeText(costCenter) === normalizeText(areaCode) ||
      normalizeText(areaId) === normalizeText(areaCode)) {
      return true;
    }

    // Older mappings can retain a cost-center code that BUK no longer returns.
    // Keep that legacy link only when the display label itself is unambiguous;
    // duplicate labels must resolve by the exact BUK identifier above.
    return sameLabelMappingCount === 1 && hasUniqueAreaLabel(area, label, allAreas);
  }

  if (exactContractNumber && directAreaIdentifiers(area).includes(normalizeText(contractNumber))) {
    return true;
  }

  return sameLabelMappingCount === 1 && hasUniqueAreaLabel(area, label, allAreas);
}

/**
 * Tries area labels from most specific to broadest. A matching display label
 * must not stop resolution unless at least one mapping also passes the exact
 * area/cost-center check.
 */
export function findExactBukAreaMappings(
  labels: string[],
  mappingByArea: Map<string, BukContractAreaMapping[]>,
  area: BukRecord,
  allAreas: BukRecord[]
) {
  for (const value of labels) {
    const label = normalizeAreaLabel(value);
    const mappings = mappingByArea.get(label);
    if (!mappings) continue;

    const exactMatches = mappings.filter((mapping) =>
      isExactBukContractAreaMatch(mapping, area, allAreas, mappings.length)
    );
    if (exactMatches.length > 0) return exactMatches;
  }

  return [] as BukContractAreaMapping[];
}
