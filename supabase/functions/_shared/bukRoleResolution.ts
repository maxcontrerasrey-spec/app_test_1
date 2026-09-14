export type BukRoleCandidate = {
  id: number | string;
  name?: string | null;
  area_ids?: Array<number | string> | null;
};

function normalizeBukRoleName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function parseIntegerLike(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return null;
}

export function parseBukRoleIdFromJobPositionCode(code: string | null | undefined) {
  const match = /^BUK-ROLE-(\d+)$/i.exec(code?.trim() ?? "");
  return match ? Number.parseInt(match[1], 10) : null;
}

export function filterExactBukRolesByName<T extends BukRoleCandidate>(
  targetRoleName: string,
  candidates: T[]
) {
  const target = normalizeBukRoleName(targetRoleName);
  if (!target) return [] as T[];

  return candidates.filter((candidate) => normalizeBukRoleName(candidate.name) === target);
}

export function selectExactBukRoleForArea<T extends BukRoleCandidate>(
  targetRoleName: string,
  areaId: number,
  preferredRoleId: number | null,
  candidates: T[]
) {
  const eligible = filterExactBukRolesByName(targetRoleName, candidates).filter((candidate) =>
    (candidate.area_ids ?? [])
      .map((area) => parseIntegerLike(area))
      .includes(areaId)
  );

  const preferred = preferredRoleId == null
    ? null
    : eligible.find((candidate) => parseIntegerLike(candidate.id) === preferredRoleId) ?? null;

  if (preferred) {
    return { status: "resolved" as const, role: preferred, eligible };
  }

  if (eligible.length === 1) {
    return { status: "resolved" as const, role: eligible[0], eligible };
  }

  if (eligible.length === 0) {
    return { status: "not_found" as const, role: null, eligible };
  }

  return { status: "ambiguous" as const, role: null, eligible };
}
