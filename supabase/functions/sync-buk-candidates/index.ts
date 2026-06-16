import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type SyncRequest = {
  jobIds?: string[];
  limit?: number;
};

type BukJobRow = {
  id: string;
  recruitment_case_candidate_id: string;
  status: "pending" | "processing" | "success" | "error";
  attempts: number;
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
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

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

function buildBukBaseUrl() {
  return (Deno.env.get("BUK_EMPLOYEES_URL") ?? "https://busesjm.buk.cl/api/v1/chile/employees").trim();
}

function buildBukDocumentsUrl(employeeId: string | number) {
  const template = (
    Deno.env.get("BUK_EMPLOYEE_DOCUMENTS_URL_TEMPLATE") ??
    `${buildBukBaseUrl()}/{employee_id}/documents`
  ).trim();

  return template.replace("{employee_id}", encodeURIComponent(String(employeeId)));
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
      const name =
        (record.name as string | undefined) ??
        (record.district as string | undefined) ??
        (record.commune as string | undefined) ??
        (record.city as string | undefined) ??
        (record.location_name as string | undefined) ??
        "";
      const region =
        (record.region as string | undefined) ??
        (record.parent_name as string | undefined) ??
        (record.state as string | undefined) ??
        null;

      if (!id || !name) return null;
      return {
        id,
        name,
        region
      };
    })
    .filter((item): item is BukLocation => item !== null);
}

async function fetchAllBukLocations() {
  const locations: BukLocation[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(buildBukLocationsUrl());
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "100");

    const payload = await fetchBukJson(url.toString());
    locations.push(...parseBukLocations(payload.data ?? []));
    totalPages = Number(payload.pagination?.total_pages ?? 1);
    page += 1;
  } while (page <= totalPages);

  return locations;
}

function resolveLocationId(payload: BukCandidateSyncPayload, locations: BukLocation[]) {
  const commune = normalizeText(payload.profile.district_or_commune);
  const region = normalizeText(payload.profile.region);

  if (!commune) {
    throw new Error("La ficha BUK del candidato no tiene comuna para resolver location_id");
  }

  const match = locations.find((location) => {
    const sameCommune = normalizeText(location.name) === commune;
    if (!sameCommune) return false;
    if (!region) return true;
    return normalizeText(location.region) === region;
  });

  if (!match) {
    throw new Error(
      `No fue posible resolver location_id en Buk para comuna "${payload.profile.district_or_commune}" y región "${payload.profile.region ?? ""}"`
    );
  }

  return match.id;
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
    start_date: worker.company_entry_date || payload.case.requested_entry_date || payload.candidate.hired_at || undefined
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

async function uploadBukDocument(
  employeeId: string,
  documentName: string,
  fileBlob: Blob,
) {
  const formData = new FormData();
  formData.append("file", fileBlob, documentName);
  formData.append("name", documentName);

  const authToken = requireEnv(Deno.env.get("BUK_AUTH_TOKEN"), "BUK_AUTH_TOKEN");
  const response = await fetch(buildBukDocumentsUrl(employeeId), {
    method: "POST",
    headers: {
      auth_token: authToken
    },
    body: formData
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Buk document upload ${response.status} ${response.statusText}: ${body}`);
  }
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
) {
  for (const document of payload.documents) {
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
    await uploadBukDocument(employeeId, bukFileName, fileData);

    const { error: removeError } = await supabase.storage
      .from("candidate-docs")
      .remove([document.file_path]);

    if (removeError) {
      throw new Error(`El documento se subió a Buk, pero no se pudo eliminar ${document.document_name} de Supabase Storage: ${removeError.message}`);
    }
  }
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

async function fetchJobs(
  supabase: ReturnType<typeof createClient>,
  request: SyncRequest
) {
  let query = supabase
    .from("buk_sync_jobs")
    .select("id, recruitment_case_candidate_id, status, attempts")
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(request.limit ?? 10, 1), 50));

  if (request.jobIds && request.jobIds.length > 0) {
    query = query.in("id", request.jobIds);
  } else {
    query = query.eq("status", "pending");
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`No fue posible leer la cola BUK: ${error.message}`);
  }

  return (data ?? []) as BukJobRow[];
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
    const requestBody = req.method === "POST" ? ((await req.json().catch(() => ({}))) as SyncRequest) : {};
    const jobs = await fetchJobs(supabase, requestBody);
    const locations = await fetchAllBukLocations();
    const results: Array<Record<string, unknown>> = [];

    for (const job of jobs) {
      try {
        await markJobState(supabase, job.id, {
          status: "processing",
          attempts: job.attempts + 1,
          started_at: new Date().toISOString(),
          error_message: null
        });

        const { data: syncPayload, error: payloadError } = await supabase.rpc(
          "get_candidate_buk_sync_payload",
          { p_case_candidate_id: job.recruitment_case_candidate_id }
        );

        if (payloadError || !syncPayload) {
          throw new Error(payloadError?.message ?? "No fue posible construir el payload del candidato");
        }

        const payload = syncPayload as BukCandidateSyncPayload;
        const { employeeId, employeePayload } = await createBukEmployee(payload, locations);

        await processDocuments(supabase, payload, employeeId);

        await markJobState(supabase, job.id, {
          status: "success",
          buk_employee_id: employeeId,
          payload_snapshot: employeePayload,
          finished_at: new Date().toISOString()
        });

        results.push({
          jobId: job.id,
          candidateId: job.recruitment_case_candidate_id,
          status: "success",
          bukEmployeeId: employeeId
        });
      } catch (error) {
        const message = toErrorMessage(error);
        await markJobState(supabase, job.id, {
          status: "error",
          error_message: message,
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
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
