import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { buildBukBaseUrl } from "../_shared/bukDocuments.ts";
import { getSupabaseSecretKey } from "../_shared/supabaseKeys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

type BukRoleRecord = Record<string, unknown>;
type JobPositionPayload = {
  code: string;
  name: string;
  is_active: boolean;
};

type BukAreaRecord = Record<string, unknown>;
type ContractMapping = {
  contract_id: number;
  buk_area_name: string;
};

type ExistingJobPosition = {
  id: number;
  code: string;
  name: string;
};

type EdgeClient = ReturnType<typeof createClient<any, "public", any>>;

function secretsMatch(candidate: string, expected: string) {
  if (candidate.length !== expected.length) return false;

  let mismatch = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    mismatch |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return mismatch === 0;
}

function requireEnv(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing ${label}`);
  }

  return normalized;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resolveErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden" || message.includes("Sin permisos")) return 403;
  return 500;
}

function buildBukTenantApiUrl(pathname: string) {
  const url = new URL(buildBukBaseUrl());
  url.pathname = pathname;
  url.search = "";
  return url.toString();
}

function extractBukObjectRows(payload: unknown, collectionKeys: string[] = ["data", "items", "results"]) {
  const candidates: unknown[] = [payload];
  const payloadRecord =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;

  if (payloadRecord) {
    for (const key of collectionKeys) {
      if (key in payloadRecord) {
        candidates.push(payloadRecord[key]);
      }
    }

    const nestedData =
      payloadRecord.data && typeof payloadRecord.data === "object" && !Array.isArray(payloadRecord.data)
        ? (payloadRecord.data as Record<string, unknown>)
        : null;

    if (nestedData) {
      for (const key of collectionKeys) {
        if (key in nestedData) {
          candidates.push(nestedData[key]);
        }
      }
    }
  }

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    return candidate.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    );
  }

  return [] as Array<Record<string, unknown>>;
}

function readText(record: BukRoleRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }
  }

  return "";
}

function readActive(record: BukRoleRecord) {
  const candidates = [
    record.active,
    record.is_active,
    record.enabled,
    record.status,
    record.estado
  ];

  for (const value of candidates) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = normalizeText(value);
      if (["activo", "active", "habilitado", "enabled", "vigente"].includes(normalized)) return true;
      if (["inactivo", "inactive", "deshabilitado", "disabled", "no vigente"].includes(normalized)) return false;
    }
  }

  return true;
}

function mapBukRoleToJobPosition(record: BukRoleRecord) {
  const name = readText(record, ["name", "nombre", "title", "role_name"]);
  if (!name) {
    return null;
  }

  const code = readText(record, ["id", "code", "codigo", "role_id"]) || name;
  return {
    code: `BUK-ROLE-${code}`,
    name,
    is_active: readActive(record)
  };
}

async function fetchBukJson(url: string) {
  const authToken = requireEnv(Deno.env.get("BUK_AUTH_TOKEN"), "BUK_AUTH_TOKEN");
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      auth_token: authToken
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`BUK roles request failed with status ${response.status}: ${body.slice(0, 240)}`);
  }

  return response.json();
}

function resolveNextPage(payload: unknown, currentPage: number) {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const pagination =
    record.pagination && typeof record.pagination === "object" && !Array.isArray(record.pagination)
      ? (record.pagination as Record<string, unknown>)
      : record;

  const next = pagination.next ?? pagination.next_page;
  if (typeof next === "number" && Number.isFinite(next)) return Math.trunc(next);
  if (typeof next === "string" && next.trim()) {
    const parsed = Number(next);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);

    try {
      const nextUrl = new URL(next);
      const page = Number(nextUrl.searchParams.get("page"));
      return Number.isFinite(page) ? Math.trunc(page) : null;
    } catch {
      return null;
    }
  }

  const totalPages = pagination.total_pages ?? pagination.totalPages;
  if (typeof totalPages === "number" && currentPage < totalPages) return currentPage + 1;
  if (typeof totalPages === "string") {
    const parsed = Number(totalPages);
    if (Number.isFinite(parsed) && currentPage < parsed) return currentPage + 1;
  }

  return null;
}

async function fetchAllBukRoles() {
  const allRoles: BukRoleRecord[] = [];

  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(buildBukTenantApiUrl("/api/v1/roles"));
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "100");

    const payload = await fetchBukJson(url.toString());
    const rows = extractBukObjectRows(payload);
    allRoles.push(...rows);

    const nextPage = resolveNextPage(payload, page);
    if (!nextPage || rows.length === 0) {
      break;
    }

    page = nextPage - 1;
  }

  return allRoles;
}

async function fetchAllBukAreas() {
  const allAreas: BukAreaRecord[] = [];

  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(buildBukTenantApiUrl("/api/v1/organization/areas"));
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "100");

    const payload = await fetchBukJson(url.toString());
    const rows = extractBukObjectRows(payload);
    allAreas.push(...rows);

    const nextPage = resolveNextPage(payload, page);
    if (!nextPage || rows.length === 0) break;
    page = nextPage - 1;
  }

  return allAreas;
}

function readNumericId(record: BukRoleRecord, keys: string[]) {
  const value = readText(record, keys);
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeBukAreaLabel(value: string | null | undefined) {
  return normalizeText(value).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function areaLabels(area: BukAreaRecord) {
  const parent = area.parent_area;
  const parentRecord = parent && typeof parent === "object" && !Array.isArray(parent)
    ? parent as BukAreaRecord
    : null;

  return [
    readText(area, ["name", "area_name"]),
    readText(area, ["second_level_name", "department_name"]),
    parentRecord ? readText(parentRecord, ["name", "area_name"]) : ""
  ].map(normalizeBukAreaLabel).filter(Boolean);
}

function readAreaActive(area: BukAreaRecord) {
  const status = readText(area, ["status", "estado", "active", "is_active"]);
  return !status || !["inactive", "inactivo", "disabled", "deshabilitado", "archived"].includes(normalizeText(status));
}

async function assertCatalogSyncAccess(accessToken: string) {
  const supabaseUrl = requireEnv(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
  const serviceRoleKey = getSupabaseSecretKey();
  const supabase = createClient<any, "public", any>(supabaseUrl, serviceRoleKey);

  if (secretsMatch(accessToken, serviceRoleKey)) {
    return supabase;
  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: canCreateRequests, error: requestAccessError } = await supabase.rpc("user_can_access_module", {
    target_user_id: user.id,
    target_module_code: "solicitud_contrataciones"
  });

  if (requestAccessError) {
    throw new Error(`No fue posible validar permisos del catalogo: ${requestAccessError.message}`);
  }

  const { data: canRecruit, error: recruitmentAccessError } = await supabase.rpc("user_can_access_module", {
    target_user_id: user.id,
    target_module_code: "reclutamiento"
  });

  if (recruitmentAccessError) {
    throw new Error(`No fue posible validar permisos de reclutamiento: ${recruitmentAccessError.message}`);
  }

  if (!canCreateRequests && !canRecruit) {
    throw new Error("Forbidden");
  }

  return supabase;
}

async function syncJobPositions(
  supabase: EdgeClient,
  positions: JobPositionPayload[],
  roles: BukRoleRecord[],
  areas: BukAreaRecord[]
) {
  if (positions.length === 0) {
    throw new Error("BUK no devolvio cargos para sincronizar");
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("job_positions")
    .select("id, code, name");

  if (existingError) {
    throw new Error(`No fue posible leer cargos locales: ${existingError.message}`);
  }

  const existingByCode = new Map<string, ExistingJobPosition>();
  const existingByName = new Map<string, ExistingJobPosition>();

  for (const row of (existingRows ?? []) as ExistingJobPosition[]) {
    existingByCode.set(row.code, row);
    existingByName.set(normalizeText(row.name), row);
  }

  let synced = 0;
  const inserts: JobPositionPayload[] = [];

  for (const position of positions) {
    const existing = existingByCode.get(position.code) ?? existingByName.get(normalizeText(position.name));

    if (!existing) {
      inserts.push(position);
      continue;
    }

    const { error } = await supabase
      .from("job_positions")
      .update(position)
      .eq("id", existing.id);

    if (error) {
      throw new Error(`No fue posible actualizar cargo BUK ${position.name}: ${error.message}`);
    }

    synced += 1;
  }

  if (inserts.length > 0) {
    const { error } = await supabase
      .from("job_positions")
      .insert(inserts);

    if (error) {
      throw new Error(`No fue posible insertar cargos BUK: ${error.message}`);
    }

    synced += inserts.length;
  }

  const { data: syncedRows, error: syncedRowsError } = await supabase
    .from("job_positions")
    .select("id, code, name")
    .in("code", positions.map((position) => position.code));

  if (syncedRowsError) {
    throw new Error(`No fue posible resolver cargos BUK sincronizados: ${syncedRowsError.message}`);
  }

  const positionByCode = new Map(
    ((syncedRows ?? []) as ExistingJobPosition[]).map((row) => [row.code, row])
  );
  const { data: mappings, error: mappingsError } = await supabase
    .from("buk_contract_mappings")
    .select("contract_id, buk_area_name, contracts!inner(is_active)")
    .eq("is_operational", true)
    .eq("is_one_to_one", true)
    .eq("contracts.is_active", true)
    .not("contract_id", "is", null);

  if (mappingsError) {
    throw new Error(`No fue posible leer contratos BUK: ${mappingsError.message}`);
  }

  const mappingByArea = new Map<string, ContractMapping[]>();
  for (const row of (mappings ?? []) as Array<ContractMapping & { contract_id: number | null }>) {
    if (!row.contract_id) continue;
    const key = normalizeBukAreaLabel(row.buk_area_name);
    const current = mappingByArea.get(key) ?? [];
    current.push({ contract_id: row.contract_id, buk_area_name: row.buk_area_name });
    mappingByArea.set(key, current);
  }

  const areaById = new Map<number, BukAreaRecord>();
  for (const area of areas) {
    const id = readNumericId(area, ["id", "area_id"]);
    if (id) areaById.set(id, area);
  }

  const accessRows = new Map<string, Record<string, unknown>>();
  for (const role of roles) {
    if (!readActive(role)) continue;
    const roleId = readNumericId(role, ["id", "role_id"]);
    const position = roleId ? positionByCode.get(`BUK-ROLE-${roleId}`) : null;
    if (!roleId || !position) continue;
    const rawAreaIds = Array.isArray(role.area_ids) ? role.area_ids : [];

    for (const rawAreaId of rawAreaIds) {
      const areaId = Number(rawAreaId);
      const area = Number.isSafeInteger(areaId) ? areaById.get(areaId) : null;
      if (!area || !readAreaActive(area)) continue;

      for (const label of areaLabels(area)) {
        for (const mapping of mappingByArea.get(label) ?? []) {
          const key = `${position.id}:${mapping.contract_id}:${areaId}`;
          accessRows.set(key, {
            job_position_id: position.id,
            contract_id: mapping.contract_id,
            buk_role_id: roleId,
            buk_area_id: areaId,
            buk_area_name: readText(area, ["name", "area_name"]) || mapping.buk_area_name,
            is_active: true,
            synced_at: new Date().toISOString()
          });
        }
        if (mappingByArea.has(label)) break;
      }
    }
  }

  if (accessRows.size === 0) {
    throw new Error("BUK no devolvio habilitaciones cargo-contrato compatibles");
  }

  const syncStartedAt = new Date().toISOString();
  const rows = [...accessRows.values()].map((row) => ({ ...row, synced_at: syncStartedAt }));
  const { error: accessUpsertError } = await supabase
    .from("buk_job_position_contract_access")
    .upsert(rows, { onConflict: "job_position_id,contract_id,buk_area_id" });

  if (accessUpsertError) {
    throw new Error(`No fue posible guardar habilitaciones cargo-contrato: ${accessUpsertError.message}`);
  }

  const { error: deactivateError } = await supabase
    .from("buk_job_position_contract_access")
    .update({ is_active: false })
    .eq("is_active", true)
    .lt("synced_at", syncStartedAt);

  if (deactivateError) {
    throw new Error(`No fue posible cerrar habilitaciones obsoletas: ${deactivateError.message}`);
  }

  return { synced, contractAccessSynced: rows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!accessToken) {
      throw new Error("Unauthorized");
    }

    const supabase = await assertCatalogSyncAccess(accessToken);
    const roles = await fetchAllBukRoles();
    const areas = await fetchAllBukAreas();
    const positions = roles
      .map(mapBukRoleToJobPosition)
      .filter((position): position is NonNullable<typeof position> => Boolean(position));

    const uniqueByCode = new Map<string, { code: string; name: string; is_active: boolean }>();
    for (const position of positions) {
      uniqueByCode.set(position.code, position);
    }

    const syncResult = await syncJobPositions(supabase, [...uniqueByCode.values()], roles, areas);

    return new Response(
      JSON.stringify({
        synced: syncResult.synced,
        contractAccessSynced: syncResult.contractAccessSynced,
        source: "buk_roles_and_areas"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("sync-buk-job-positions failed");
    return new Response(
      JSON.stringify({ error: "No fue posible sincronizar cargos BUK." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: resolveErrorStatus(error)
      }
    );
  }
});
