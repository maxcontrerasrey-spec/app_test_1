import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildBukBaseUrl } from "../_shared/bukDocuments.ts";

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

type ExistingJobPosition = {
  id: number;
  code: string;
  name: string;
};

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
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
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

async function assertCatalogSyncAccess(accessToken: string) {
  const supabaseUrl = requireEnv(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
  const serviceRoleKey = requireEnv(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);
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
  supabase: ReturnType<typeof createClient>,
  positions: JobPositionPayload[]
) {
  if (positions.length === 0) {
    return 0;
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

  return synced;
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
    const positions = roles
      .map(mapBukRoleToJobPosition)
      .filter((position): position is NonNullable<typeof position> => Boolean(position));

    const uniqueByName = new Map<string, { code: string; name: string; is_active: boolean }>();
    for (const position of positions) {
      uniqueByName.set(normalizeText(position.name), position);
    }

    const syncedCount = await syncJobPositions(supabase, [...uniqueByName.values()]);

    return new Response(
      JSON.stringify({
        synced: syncedCount,
        source: "buk_roles"
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
