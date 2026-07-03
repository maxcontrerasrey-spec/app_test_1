import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildBukBaseUrl,
  extractBukDocumentMetadata,
  uploadBukDocument
} from "../_shared/bukDocuments.ts";

type SyncRequest = {
  jobIds?: string[];
  limit?: number;
};

type BukJobRow = {
  id: string;
  recruitment_case_candidate_id: string;
  status: "pending" | "processing" | "success" | "error";
  attempts: number;
  payload_snapshot: Record<string, unknown> | null;
  result_snapshot: Record<string, unknown> | null;
};

type BukCandidateSyncPayload = {
  candidate: {
    case_candidate_id: string;
    recruitment_case_id: string;
    candidate_profile_id: string;
    stage_code: string;
    document_validation_status: string | null;
    hired_at: string | null;
  };
  case: {
    id: string;
    case_code: string;
    contract_name: string | null;
    job_position_name: string | null;
    requested_entry_date: string | null;
  };
  profile: {
    document_type: string | null;
    document_number: string | null;
    first_name: string | null;
    last_name: string | null;
    second_last_name: string | null;
    full_name: string | null;
    gender: string | null;
    birth_date: string | null;
    nationality: string | null;
    marital_status: string | null;
    email: string | null;
    personal_email: string | null;
    phone: string | null;
    office_phone: string | null;
    country: string | null;
    address_line: string | null;
    region: string | null;
    district_or_commune: string | null;
    current_city: string | null;
    street_name: string | null;
    street_number: string | null;
    apartment_or_office: string | null;
    education_title: string | null;
    education_institution: string | null;
    worker_file: {
      employee_code: string | null;
      project_name: string | null;
      company_entry_date: string | null;
      shift_name: string | null;
      contract_notes: string | null;
      private_role: string | null;
      payment_method: string | null;
      payment_period: string | null;
      bank_name: string | null;
      bank_account_type: string | null;
      bank_account_number: string | null;
      pension_regime: string | null;
      contribution_fund: string | null;
      afp_collection_entity: string | null;
      increase_quote_one_percent: string | null;
      health_provider: string | null;
      health_plan_uf: number | null;
      health_plan_percentage: number | null;
      afc_regime: string | null;
      retired_status: string | null;
      retirement_regime: string | null;
      currency: string | null;
    };
  };
  documents: Array<{
    id: string;
    document_name: string;
    file_path: string | null;
    status: string;
  }>;
};

type BukLocation = {
  id: number | string;
  name: string;
  region: string | null;
  depth: number | null;
  full_name: string | null;
};

type BukLocationCacheRow = {
  location_id: string;
  location_name: string;
  region_name: string | null;
  synced_at: string | null;
  raw_payload?: Record<string, unknown> | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-webhook-secret"
};

const DEFAULT_BUK_LOCATIONS_CACHE_TTL_HOURS = 12;

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requireEnv(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing ${label}`);
  }
  return normalized;
}

function resolveErrorStatus(error: unknown) {
  const message = toErrorMessage(error);
  if (message === "Unauthorized") {
    return 401;
  }
  if (message.includes("Sin permisos")) {
    return 403;
  }
  if (message.includes("Debe indicar")) {
    return 400;
  }

  return 500;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeDocumentNumber(documentType: string | null | undefined, documentNumber: string | null | undefined) {
  const raw = (documentNumber ?? "").trim();
  if (!raw) {
    return "";
  }

  if (normalizeText(documentType) === "rut") {
    return raw.replace(/[.\-]/g, "");
  }

  return raw;
}

function resolveGender(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (normalized === "m" || normalized === "masculino" || normalized === "male") return "M";
  if (normalized === "f" || normalized === "femenino" || normalized === "female") return "F";
  return value?.trim() || "";
}

function resolvePrivateRole(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized === "si" || normalized === "sí" || normalized === "true";
}

function buildBukHealthPlanPayload(worker: BukCandidateSyncPayload["profile"]["worker_file"]) {
  const provider = normalizeText(worker.health_provider);
  const healthPlanUf =
    typeof worker.health_plan_uf === "number" && Number.isFinite(worker.health_plan_uf)
      ? worker.health_plan_uf
      : null;
  const healthPlanPercentage =
    typeof worker.health_plan_percentage === "number" &&
    Number.isFinite(worker.health_plan_percentage)
      ? worker.health_plan_percentage
      : null;

  if (provider === "fonasa" && healthPlanPercentage != null) {
    return {
      health_company_plan: healthPlanPercentage,
      health_company_plan_currency: "%",
      health_company_plan_percentage: healthPlanPercentage
    };
  }

  if (healthPlanUf != null) {
    return {
      health_company_plan: healthPlanUf,
      health_company_plan_currency: "UF"
    };
  }

  return {};
}

function buildBukLocationsUrl() {
  const customUrl = Deno.env.get("BUK_LOCATIONS_URL")?.trim();
  if (customUrl) {
    return customUrl;
  }

  const employeesUrl = new URL(buildBukBaseUrl());
  employeesUrl.pathname = employeesUrl.pathname.replace(/\/employees$/, "/locations");
  employeesUrl.search = "";
  return employeesUrl.toString();
}

async function fetchBukJson(url: string, init: RequestInit = {}) {
  const authToken = requireEnv(Deno.env.get("BUK_AUTH_TOKEN"), "BUK_AUTH_TOKEN");
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      auth_token: authToken,
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Buk API ${response.status} ${response.statusText}: ${body}`);
  }

  return response.json();
}

function parseBukLocations(rawData: unknown): BukLocation[] {
  if (!Array.isArray(rawData)) {
    return [];
  }

  return rawData
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const id = record.id ?? record.location_id;
      const fullName =
        (record.full_name as string | undefined) ??
        (record.fullName as string | undefined) ??
        null;
      const depth = typeof record.depth === "number" ? record.depth : null;
      const name =
        (record.name as string | undefined) ??
        (record.district as string | undefined) ??
        (record.commune as string | undefined) ??
        (record.city as string | undefined) ??
        (record.location_name as string | undefined) ??
        "";
      const fullNameSegments =
        typeof fullName === "string"
          ? fullName
              .split(" - ")
              .map((segment) => segment.trim())
              .filter(Boolean)
          : [];
      const derivedRegionFromFullName =
        fullNameSegments.length >= 2 ? fullNameSegments[1] : null;
      const region =
        (record.region as string | undefined) ??
        (record.parent_name as string | undefined) ??
        (record.state as string | undefined) ??
        derivedRegionFromFullName ??
        null;

      if (!id || !name) return null;
      return {
        id,
        name,
        region,
        depth,
        full_name: fullName
      };
    })
    .filter((item): item is BukLocation => item !== null);
}

async function fetchBukLocationsByDepth(depth?: number) {
  const locations: BukLocation[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(buildBukLocationsUrl());
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "100");
    if (depth !== undefined) {
      url.searchParams.set("depth", String(depth));
    }

    const payload = await fetchBukJson(url.toString());
    locations.push(...parseBukLocations(payload.data ?? []));
    totalPages = Number(payload.pagination?.total_pages ?? 1);
    page += 1;
  } while (page <= totalPages);

  return locations;
}

async function fetchAllBukLocations() {
  const communeLocations = await fetchBukLocationsByDepth(3);
  if (communeLocations.length > 0) {
    return communeLocations;
  }

  return fetchBukLocationsByDepth();
}

function resolveBukLocationsCacheTtlMs() {
  const rawValue = Number(Deno.env.get("BUK_LOCATIONS_CACHE_TTL_HOURS") ?? DEFAULT_BUK_LOCATIONS_CACHE_TTL_HOURS);
  const hours = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : DEFAULT_BUK_LOCATIONS_CACHE_TTL_HOURS;
  return hours * 60 * 60 * 1000;
}

function mapBukLocationCacheRows(rows: BukLocationCacheRow[]) {
  return rows.map((row) => ({
    id: row.location_id,
    name: row.location_name,
    region: row.region_name,
    depth:
      row.raw_payload && typeof row.raw_payload.depth === "number"
        ? row.raw_payload.depth
        : null,
    full_name:
      row.raw_payload && typeof row.raw_payload.full_name === "string"
        ? row.raw_payload.full_name
        : null
  }));
}

function isBukLocationCacheFresh(rows: BukLocationCacheRow[]) {
  if (rows.length === 0) {
    return false;
  }

  const latestSyncedAt = rows.reduce<number>((currentMax, row) => {
    const value = row.synced_at ? Date.parse(row.synced_at) : Number.NaN;
    return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
  }, Number.NEGATIVE_INFINITY);

  if (!Number.isFinite(latestSyncedAt)) {
    return false;
  }

  return Date.now() - latestSyncedAt <= resolveBukLocationsCacheTtlMs();
}

function hasPreferredBukLocationDepth(rows: BukLocationCacheRow[]) {
  return rows.some((row) => {
    if (row.region_name) {
      return true;
    }

    const depth = row.raw_payload?.depth;
    return typeof depth === "number" && depth >= 3;
  });
}

async function loadBukLocationsCache(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("buk_locations")
    .select("location_id, location_name, region_name, synced_at, raw_payload")
    .order("location_name", { ascending: true });

  if (error) {
    throw new Error(`No fue posible leer el caché local de ubicaciones BUK: ${error.message}`);
  }

  return (data ?? []) as BukLocationCacheRow[];
}

async function writeBukLocationsCache(
  supabase: ReturnType<typeof createClient>,
  cachedRows: BukLocationCacheRow[],
  locations: BukLocation[]
) {
  if (locations.length === 0) {
    throw new Error("Buk no retornó ubicaciones para refrescar el caché local");
  }

  const syncedAt = new Date().toISOString();
  const payload = locations.map((location) => ({
    location_id: String(location.id),
    location_name: location.name,
    region_name: location.region,
    raw_payload: {
      id: location.id,
      name: location.name,
      region: location.region,
      depth: location.depth,
      full_name: location.full_name
    },
    synced_at: syncedAt
  }));

  const { error: upsertError } = await supabase
    .from("buk_locations")
    .upsert(payload, { onConflict: "location_id" });

  if (upsertError) {
    throw new Error(`No fue posible refrescar el caché local de ubicaciones BUK: ${upsertError.message}`);
  }

  const freshIds = new Set(payload.map((row) => row.location_id));
  const staleIds = cachedRows
    .map((row) => row.location_id)
    .filter((locationId) => !freshIds.has(locationId));

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("buk_locations")
      .delete()
      .in("location_id", staleIds);

    if (deleteError) {
      throw new Error(`No fue posible limpiar ubicaciones BUK obsoletas: ${deleteError.message}`);
    }
  }
}

async function resolveBukLocations(supabase: ReturnType<typeof createClient>) {
  const cachedRows = await loadBukLocationsCache(supabase);
  const cachedLocations = mapBukLocationCacheRows(cachedRows);

  if (isBukLocationCacheFresh(cachedRows) && hasPreferredBukLocationDepth(cachedRows)) {
    return cachedLocations;
  }

  try {
    const freshLocations = await fetchAllBukLocations();
    await writeBukLocationsCache(supabase, cachedRows, freshLocations);
    return freshLocations;
  } catch (error) {
    if (cachedLocations.length > 0) {
      console.warn(
        `BUK locations refresh failed, using stale local cache (${cachedLocations.length} rows): ${toErrorMessage(error)}`
      );
      return cachedLocations;
    }

    throw error;
  }
}

function resolveLocationId(payload: BukCandidateSyncPayload, locations: BukLocation[]) {
  const commune = normalizeText(payload.profile.district_or_commune);
  const region = normalizeText(payload.profile.region);

  if (!commune && !region) {
    throw new Error("La ficha BUK del candidato no tiene comuna ni región para resolver location_id");
  }

  const exactCommuneAndRegion = locations.find((location) => {
    if (!commune) return false;
    if (normalizeText(location.name) !== commune) return false;
    if (!region) return true;
    return normalizeText(location.region) === region;
  });

  if (exactCommuneAndRegion) {
    return exactCommuneAndRegion.id;
  }

  const exactCommune = locations.find(
    (location) => Boolean(commune) && normalizeText(location.name) === commune
  );

  if (exactCommune) {
    return exactCommune.id;
  }

  const exactRegion = locations.find(
    (location) => Boolean(region) && normalizeText(location.name) === region
  );

  if (exactRegion) {
    return exactRegion.id;
  }

  const parentRegion = locations.find(
    (location) => Boolean(region) && normalizeText(location.region) === region
  );

  if (parentRegion) {
    return parentRegion.id;
  }

  const regionalOnlyLocations = locations.filter((location) => !normalizeText(location.region));
  const regionalOnlyMatch = regionalOnlyLocations.find(
    (location) => Boolean(region) && normalizeText(location.name) === region
  );

  if (regionalOnlyMatch) {
    return regionalOnlyMatch.id;
  }

  if (!commune) {
    throw new Error(
      `No fue posible resolver location_id en Buk para región "${payload.profile.region ?? ""}"`
    );
  }

  throw new Error(
    `No fue posible resolver location_id en Buk para comuna "${payload.profile.district_or_commune}" y región "${payload.profile.region ?? ""}"`
  );
}

function buildBukEmployeePayload(payload: BukCandidateSyncPayload, locationId: string | number) {
  const profile = payload.profile;
  const worker = payload.profile.worker_file;

  const documentType = normalizeText(profile.document_type) === "rut" ? "rut" : "otro";

  return {
    first_name: profile.first_name,
    surname: profile.last_name,
    second_surname: profile.second_last_name || undefined,
    document_type: documentType,
    document_number: normalizeDocumentNumber(profile.document_type, profile.document_number),
    nationality: profile.nationality,
    country_code: normalizeText(profile.country) === "chile" || !profile.country ? "CL" : profile.country,
    civil_status: profile.marital_status,
    email: profile.email || undefined,
    personal_email: profile.personal_email || undefined,
    address: profile.address_line,
    street: profile.street_name || undefined,
    street_number: profile.street_number || undefined,
    office_number: profile.apartment_or_office || undefined,
    city: profile.current_city || profile.district_or_commune || undefined,
    district: profile.district_or_commune,
    location_id: locationId,
    region: profile.region,
    office_phone: profile.office_phone || undefined,
    phone: profile.phone || undefined,
    gender: resolveGender(profile.gender),
    birthday: profile.birth_date,
    university: profile.education_institution || undefined,
    degree: profile.education_title || undefined,
    private_role: resolvePrivateRole(worker.private_role),
    code_sheet: worker.employee_code,
    health_company: worker.health_provider,
    pension_regime: worker.pension_regime,
    pension_fund: worker.contribution_fund || worker.afp_collection_entity || undefined,
    retired: normalizeText(worker.retired_status) === "si" || normalizeText(worker.retired_status) === "sí",
    retirement_regime: worker.retirement_regime,
    afc: worker.afc_regime,
    bank: worker.bank_name || undefined,
    payment_currency: worker.currency || "CLP",
    payment_method: worker.payment_method,
    payment_period: worker.payment_period,
    account_type: worker.bank_account_type || undefined,
    account_number: worker.bank_account_number || undefined,
    active_since: worker.company_entry_date || payload.case.requested_entry_date || payload.candidate.hired_at || undefined,
    start_date: worker.company_entry_date || payload.case.requested_entry_date || payload.candidate.hired_at || undefined,
    ...buildBukHealthPlanPayload(worker)
  };
}

async function createBukEmployee(payload: BukCandidateSyncPayload, locations: BukLocation[]) {
  const employeePayload = buildBukEmployeePayload(payload, resolveLocationId(payload, locations));
  const response = await fetchBukJson(buildBukBaseUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(employeePayload)
  });

  const employeeId =
    response.data?.id ??
    response.id ??
    response.employee_id ??
    null;

  if (!employeeId) {
    throw new Error("Buk no retornó el identificador del empleado creado");
  }

  return {
    employeeId: String(employeeId),
    employeePayload
  };
}

function buildBukDocumentFileName(payload: BukCandidateSyncPayload, originalName: string) {
  const safeBaseName = originalName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  const extension = safeBaseName.includes(".") ? safeBaseName.slice(safeBaseName.lastIndexOf(".")) : ".pdf";
  const stem = safeBaseName.replace(/\.[^.]+$/, "");
  const documentNumber = normalizeDocumentNumber(payload.profile.document_type, payload.profile.document_number);
  return `${stem || "documento"}_${documentNumber}${extension}`;
}

async function processDocuments(
  supabase: ReturnType<typeof createClient>,
  payload: BukCandidateSyncPayload,
  employeeId: string,
  uploadedDocuments: Array<Record<string, unknown>>,
  alreadyUploadedDocumentIds: Set<string>,
) {
  for (const document of payload.documents) {
    if (alreadyUploadedDocumentIds.has(document.id)) {
      continue;
    }

    if (!document.file_path) {
      continue;
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("candidate-docs")
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error(`No fue posible descargar ${document.document_name}: ${downloadError?.message ?? "sin archivo"}`);
    }

    const bukFileName = buildBukDocumentFileName(payload, document.document_name);
    const uploadResult = await uploadBukDocument(employeeId, bukFileName, fileData);
    const uploadPayload = uploadResult.payload;
    const { bukDocumentId, bukDocumentUrl } = extractBukDocumentMetadata(uploadPayload);

    const { error: removeError } = await supabase.storage
      .from("candidate-docs")
      .remove([document.file_path]);

    if (removeError) {
      throw new Error(`El documento se subió a Buk, pero no se pudo eliminar ${document.document_name} de Supabase Storage: ${removeError.message}`);
    }

    uploadedDocuments.push({
      sourceDocumentId: document.id,
      sourceDocumentName: document.document_name,
      sourceFilePath: document.file_path,
      bukDocumentId,
      bukDocumentUrl,
      bukDocumentName: bukFileName,
      transport: uploadResult.transport,
      status: uploadResult.status,
      response: uploadPayload
    });
    alreadyUploadedDocumentIds.add(document.id);
  }

  return uploadedDocuments;
}

function extractUploadedDocumentsFromSnapshot(snapshot: Record<string, unknown> | null) {
  const documents = snapshot?.documents;
  if (!Array.isArray(documents)) {
    return [] as Array<Record<string, unknown>>;
  }

  return documents.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
  );
}

function resolveAuthorizedPayload(job: BukJobRow) {
  const snapshot = job.payload_snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("El job BUK no tiene un payload autorizado disponible.");
  }

  const candidate = snapshot.candidate;
  const profile = snapshot.profile;
  const jobCase = snapshot.case;
  const documents = snapshot.documents;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    !profile ||
    typeof profile !== "object" ||
    !jobCase ||
    typeof jobCase !== "object" ||
    !Array.isArray(documents)
  ) {
    throw new Error("El payload autorizado del job BUK esta incompleto o es invalido.");
  }

  return snapshot as unknown as BukCandidateSyncPayload;
}

async function markJobState(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  values: Record<string, unknown>
) {
  const { error } = await supabase
    .from("buk_sync_jobs")
    .update(values)
    .eq("id", jobId);

  if (error) {
    throw new Error(`No fue posible actualizar buk_sync_jobs ${jobId}: ${error.message}`);
  }
}

async function finalizeSuccessfulJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  employeeId: string,
  resultSnapshot: Record<string, unknown>
) {
  const { error } = await supabase.rpc("finalize_buk_sync_job_success", {
    p_job_id: jobId,
    p_buk_employee_id: employeeId,
    p_result_snapshot: resultSnapshot
  });

  if (error) {
    throw new Error(`No fue posible cerrar el job BUK ${jobId}: ${error.message}`);
  }
}

async function claimJobs(
  supabase: ReturnType<typeof createClient>,
  request: SyncRequest
) {
  const normalizedLimit = Math.min(Math.max(request.limit ?? 10, 1), 50);
  const normalizedJobIds = Array.from(
    new Set((request.jobIds ?? []).map((jobId) => jobId.trim()).filter(Boolean))
  );
  const jobIdsParam = normalizedJobIds.length > 0 ? normalizedJobIds : null;

  const { data, error } = await supabase.rpc("claim_buk_sync_jobs", {
    p_limit: normalizedLimit,
    p_job_ids: jobIdsParam
  });

  if (error) {
    throw new Error(`No fue posible reclamar la cola BUK: ${error.message}`);
  }

  return (data ?? []) as BukJobRow[];
}

async function authorizeRequestedJobs(
  supabase: ReturnType<typeof createClient>,
  actorUserId: string,
  request: SyncRequest
) {
  const normalizedJobIds = Array.from(
    new Set((request.jobIds ?? []).map((jobId) => jobId.trim()).filter(Boolean))
  );

  if (normalizedJobIds.length === 0) {
    throw new Error("Debe indicar los jobs BUK a ejecutar en una invocacion interactiva.");
  }

  const { data, error } = await supabase.rpc("authorize_buk_sync_jobs", {
    p_actor_user_id: actorUserId,
    p_job_ids: normalizedJobIds
  });

  if (error) {
    throw new Error(`No fue posible validar permisos de sincronizacion BUK: ${error.message}`);
  }

  if (data !== true) {
    throw new Error("Sin permisos para ejecutar uno o mas jobs BUK solicitados.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = requireEnv(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
  const serviceRoleKey = requireEnv(
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    "SUPABASE_SERVICE_ROLE_KEY"
  );
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const internalWebhookSecret = (Deno.env.get("BUK_SYNC_INTERNAL_WEBHOOK_SECRET") ?? "").trim();
    const suppliedWebhookSecret = (req.headers.get("x-internal-webhook-secret") ?? "").trim();
    const isInternalInvocation =
      internalWebhookSecret.length > 0 && suppliedWebhookSecret === internalWebhookSecret;
    const requestBody = req.method === "POST" ? ((await req.json().catch(() => ({}))) as SyncRequest) : {};

    if (!isInternalInvocation) {
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }

      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser(accessToken);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }

      await authorizeRequestedJobs(supabase, user.id, requestBody);
    }
    const jobs = await claimJobs(supabase, requestBody);
    const locations = await resolveBukLocations(supabase);
    const results: Array<Record<string, unknown>> = [];

    for (const job of jobs) {
      const uploadedDocuments = extractUploadedDocumentsFromSnapshot(job.result_snapshot);
      const alreadyUploadedDocumentIds = new Set(
        uploadedDocuments
          .map((entry) =>
            typeof entry.sourceDocumentId === "string" ? entry.sourceDocumentId : null
          )
          .filter((value): value is string => Boolean(value))
      );
      const jobResultSnapshot: Record<string, unknown> = {
        syncedAt: new Date().toISOString(),
        documents: uploadedDocuments
      };

      try {
        const payload = resolveAuthorizedPayload(job);
        const { employeeId, employeePayload } = await createBukEmployee(payload, locations);
        jobResultSnapshot.employee = {
          id: employeeId,
          request: employeePayload
        };

        await processDocuments(
          supabase,
          payload,
          employeeId,
          uploadedDocuments,
          alreadyUploadedDocumentIds
        );
        jobResultSnapshot.documents = uploadedDocuments;

        await finalizeSuccessfulJob(supabase, job.id, employeeId, jobResultSnapshot);

        results.push({
          jobId: job.id,
          candidateId: job.recruitment_case_candidate_id,
          status: "success",
          bukEmployeeId: employeeId
        });
      } catch (error) {
        const message = toErrorMessage(error);
        jobResultSnapshot.error = message;
        await markJobState(supabase, job.id, {
          status: "error",
          error_message: message,
          result_snapshot: jobResultSnapshot,
          finished_at: new Date().toISOString()
        });

        results.push({
          jobId: job.id,
          candidateId: job.recruitment_case_candidate_id,
          status: "error",
          error: message
        });
      }
    }

    return new Response(JSON.stringify({ processed: results }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: toErrorMessage(error) }), {
      status: resolveErrorStatus(error),
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
