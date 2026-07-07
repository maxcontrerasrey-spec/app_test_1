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
    suggested_employee_code?: string | null;
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
      health_plan_pesos?: number | null;
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

type BukEmployeeRecord = {
  id: number | string;
  status?: string | null;
  email?: string | null;
  personal_email?: string | null;
  document_number?: string | null;
  rut?: string | null;
  active_since?: string | null;
  code_sheet?: string | null;
  created_at?: string | null;
  current_job?: Record<string, unknown> | null;
};

type LocalBukEmployeeRow = {
  buk_employee_id: string | null;
  status: string | null;
  raw_payload: Record<string, unknown> | null;
  updated_at: string | null;
  area_code: string | null;
  area_name: string | null;
};

type LocalBukJobSnapshot = {
  companyId: number | null;
  areaId: number | null;
  roleId: number | null;
  roleName: string | null;
  costCenter: string | null;
  weeklyHours: number | null;
  workingScheduleType: string | null;
  otherTypeOfWorkingDay: string | null;
  leaderId: number | null;
};

type BukRoleRecord = {
  id: number | string;
  code?: string | null;
  name?: string | null;
  area_ids?: Array<number | string> | null;
};

type CandidateSyncContext = {
  areaCode: string;
  areaName: string | null;
  companyId: number;
  areaId: number;
  costCenter: string;
  leaderId: number;
  roleId: number;
  roleName: string;
  wage: number;
  currency: "peso" | "uf" | "utm";
  contractType: "Plazo fijo" | "Indefinido";
  periodicity: "mensual" | "diaria" | "hora";
  regularHours: number;
  typeOfWorkingDay: string;
  otherTypeOfWorkingDay: string | null;
  startDate: string;
  endDate: string | null;
  contractSubscriptionDate: string;
  planPayload: Record<string, unknown>;
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

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function extractDatePortion(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 10);
}

function normalizeCompactText(value: string | null | undefined) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

function tokenizeBukLabel(value: string | null | undefined) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token && !["de", "del", "la", "las", "los", "el", "y"].includes(token));
}

function parseIntegerLike(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
}

function parseFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseBukBoolean(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (["si", "sí", "true", "1"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return null;
}

const BUK_FUND_QUOTE_MAP: Record<string, string> = {
  capital: "capital",
  cuprum: "cuprum",
  habitat: "habitat",
  modelo: "modelo",
  planvital: "planvital",
  provida: "provida",
  uno: "uno",
  serviciosdesegurosocialregimen1: "servicios_de_seguro_social_regimen_1",
  empartregimen1: "empart_regimen_1",
  capremerregimen1: "capremer_regimen_1",
  triomarregimen1: "triomar_regimen_1",
  canaempupublicosregimen1: "canaempu_publicos_regimen_1",
  canaempupublicosregimen21: "canaempu_publicos_regimen_21",
  eemunicipalesrepublicaregimen1: "ee_municipales_republica_regimen_1",
  eemunicipalesrepublicaregimen2: "ee_municipales_republica_regimen_2",
  eemunicipalesrepublicaregimen3: "ee_municipales_republica_regimen_3",
  oomunicipalesrepublicaregimen1: "oo_municipales_republica_regimen_1",
  oomunicipalesrepublicaregimen2: "oo_municipales_republica_regimen_2",
  oomunicipalesrepublicaregimen3: "oo_municipales_republica_regimen_3",
  empartregimen2: "empart_regimen_2",
  serviciosdesegurosocialregimen2: "servicios_de_seguro_social_regimen_2",
  cajaferrorregimen2: "caja_ferro_regimen_2"
};

const BUK_HEALTH_COMPANY_MAP: Record<string, string> = {
  fonasa: "fonasa",
  banmedica: "banmedica",
  colmena: "colmena",
  consalud: "consalud",
  cruzblanca: "cruz_blanca",
  nuevamasvida: "nueva_masvida",
  vidatres: "vida_tres",
  bancoestado: "banco_estado",
  isaludisapredecodelco: "isalud_isapre_de_codelco",
  esencial: "esencial",
  cruznorte: "cruz_norte",
  mutual: "mutual",
  nocotizasalud: "no_cotiza_salud"
};

function mapBukPensionScheme(value: string | null | undefined) {
  const normalized = normalizeText(value);
  switch (normalized) {
    case "afp":
      return "afp";
    case "ips":
      return "ips";
    case "no cotiza":
    case "nocotiza":
      return "no_cotiza";
    default:
      throw new Error(`Regimen previsional BUK no soportado: ${value ?? "sin valor"}`);
  }
}

function mapBukFundQuote(value: string | null | undefined) {
  const normalized = normalizeCompactText(value);
  if (!normalized) {
    return null;
  }

  const mapped = BUK_FUND_QUOTE_MAP[normalized];
  if (!mapped) {
    throw new Error(`Fondo previsional BUK no soportado: ${value ?? "sin valor"}`);
  }

  return mapped;
}

function mapBukHealthCompany(value: string | null | undefined) {
  const normalized = normalizeCompactText(value);
  if (!normalized) {
    throw new Error("La salud previsional BUK no tiene un valor informado.");
  }

  const mapped = BUK_HEALTH_COMPANY_MAP[normalized];
  if (!mapped) {
    throw new Error(`Salud previsional BUK no soportada: ${value ?? "sin valor"}`);
  }

  return mapped;
}

function mapBukAfc(value: string | null | undefined) {
  const normalized = normalizeText(value);
  switch (normalized) {
    case "menos de 11 anos":
      return "normal";
    case "mas de 11 anos":
      return "reducido";
    case "no cotiza":
    case "nocotiza":
      return "no_cotiza";
    default:
      throw new Error(`Regimen AFC BUK no soportado: ${value ?? "sin valor"}`);
  }
}

function mapBukCurrency(value: string | null | undefined): "peso" | "uf" | "utm" {
  const normalized = normalizeText(value);
  switch (normalized) {
    case "":
    case "clp":
    case "peso":
    case "pesos":
      return "peso";
    case "uf":
      return "uf";
    case "utm":
      return "utm";
    default:
      return "peso";
  }
}

function mapBukPeriodicity(value: string | null | undefined): "mensual" | "diaria" | "hora" {
  const normalized = normalizeText(value);
  switch (normalized) {
    case "diaria":
      return "diaria";
    case "hora":
      return "hora";
    default:
      return "mensual";
  }
}

function buildBukTenantApiUrl(pathname: string) {
  const url = new URL(buildBukBaseUrl());
  url.pathname = pathname;
  url.search = "";
  return url.toString();
}

function parseEmployeeCodeSequence(value: string | null | undefined) {
  const match = (value ?? "").trim().match(/^F([0-9]+)$/i);
  if (!match) {
    return null;
  }

  const sequence = Number(match[1]);
  return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
}

function formatEmployeeCode(sequence: number | null) {
  if (!sequence || !Number.isFinite(sequence) || sequence <= 0) {
    return null;
  }

  return `F${Math.trunc(sequence)}`;
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
  if (provider === "fonasa") {
    return {};
  }

  const healthPlanUf = parseFiniteNumber(worker.health_plan_uf);
  const healthPlanPesos = parseFiniteNumber(worker.health_plan_pesos);
  const healthPlanPercentage = parseFiniteNumber(worker.health_plan_percentage);
  const payload: Record<string, number> = {};

  if (healthPlanUf != null) {
    payload.health_company_plan = healthPlanUf;
  }

  if (healthPlanPesos != null) {
    payload.health_company_plan_currency = healthPlanPesos;
  }

  if (healthPlanPercentage != null) {
    payload.health_company_plan_percentage = healthPlanPercentage;
  }

  return payload;
}

function resolveTargetStartDate(payload: BukCandidateSyncPayload) {
  return (
    extractDatePortion(payload.profile.worker_file.company_entry_date) ??
    extractDatePortion(payload.case.requested_entry_date) ??
    extractDatePortion(payload.candidate.hired_at)
  );
}

function resolveBukEmployeeCode(payload: BukCandidateSyncPayload) {
  return (
    payload.profile.suggested_employee_code?.trim() ||
    payload.profile.worker_file.employee_code?.trim() ||
    null
  );
}

function resolveNextBukEmployeeCode(
  payload: BukCandidateSyncPayload,
  employees: BukEmployeeRecord[]
) {
  const existingMaxSequence = employees.reduce((max, employee) => {
    const sequence = parseEmployeeCodeSequence(employee.code_sheet);
    return sequence && sequence > max ? sequence : max;
  }, 0);
  const suggestedSequence = parseEmployeeCodeSequence(payload.profile.suggested_employee_code);

  return formatEmployeeCode(Math.max(existingMaxSequence + 1, suggestedSequence ?? 0));
}

function normalizeBukEmployeeStatus(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (normalized === "activo" || normalized === "active") return "active";
  if (normalized === "inactivo" || normalized === "inactive") return "inactive";
  return normalized || "unknown";
}

function matchesBukEmployeeIdentity(employee: BukEmployeeRecord, payload: BukCandidateSyncPayload) {
  const targetDocumentNumber = normalizeDocumentNumber(
    payload.profile.document_type,
    payload.profile.document_number
  );
  const employeeDocumentNumber = normalizeDocumentNumber(
    payload.profile.document_type,
    employee.document_number ?? employee.rut ?? null
  );
  const targetEmail = normalizeEmail(payload.profile.email);
  const targetPersonalEmail = normalizeEmail(payload.profile.personal_email);
  const employeeEmail = normalizeEmail(employee.email);
  const employeePersonalEmail = normalizeEmail(employee.personal_email);

  return (
    employeeDocumentNumber === targetDocumentNumber &&
    (!targetEmail || employeeEmail === targetEmail) &&
    (!targetPersonalEmail || employeePersonalEmail === targetPersonalEmail)
  );
}

function hasBukCurrentJob(employee: BukEmployeeRecord) {
  return Boolean(
    employee.current_job &&
      typeof employee.current_job === "object" &&
      !Array.isArray(employee.current_job) &&
      Object.keys(employee.current_job).length > 0
  );
}

function matchesResolvedBukEmployeeCode(employee: BukEmployeeRecord, payload: BukCandidateSyncPayload) {
  const targetEmployeeCode = resolveBukEmployeeCode(payload);
  if (!targetEmployeeCode) {
    return false;
  }

  return normalizeText(employee.code_sheet) === normalizeText(targetEmployeeCode);
}

function isActiveBukEmployeeDuplicate(employee: BukEmployeeRecord, payload: BukCandidateSyncPayload) {
  if (normalizeBukEmployeeStatus(employee.status) !== "active") {
    return false;
  }

  if (!matchesBukEmployeeIdentity(employee, payload)) {
    return false;
  }

  const employeeStartDate = extractDatePortion(employee.active_since);
  const targetStartDate = resolveTargetStartDate(payload);
  return !targetStartDate || employeeStartDate === targetStartDate;
}

function isErpProvisionedActiveBukEmployee(employee: BukEmployeeRecord, payload: BukCandidateSyncPayload) {
  return isActiveBukEmployeeDuplicate(employee, payload) && matchesResolvedBukEmployeeCode(employee, payload);
}

function isInactiveBukEmployee(employee: BukEmployeeRecord, payload: BukCandidateSyncPayload) {
  return (
    normalizeBukEmployeeStatus(employee.status) === "inactive" &&
    matchesBukEmployeeIdentity(employee, payload)
  );
}

function isReusableIncompleteBukEmployee(
  employee: BukEmployeeRecord,
  payload: BukCandidateSyncPayload
) {
  if (!isInactiveBukEmployee(employee, payload)) {
    return false;
  }

  const employeeStartDate = extractDatePortion(employee.active_since);
  const targetStartDate = resolveTargetStartDate(payload);
  if (!employeeStartDate || !targetStartDate || employeeStartDate !== targetStartDate) {
    return false;
  }

  const targetEmployeeCode = resolveBukEmployeeCode(payload);
  if (!targetEmployeeCode) {
    return false;
  }

  return normalizeText(employee.code_sheet) === normalizeText(targetEmployeeCode);
}

function parseBukApiErrorPayload(message: string) {
  const match = message.match(/^Buk API \d+ [^:]+: ([\s\S]+)$/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractBukApiErrorMessages(error: unknown) {
  const payload = parseBukApiErrorPayload(toErrorMessage(error));
  const errors = payload?.errors;

  if (Array.isArray(errors)) {
    return errors.map((entry) => String(entry));
  }

  if (errors && typeof errors === "object") {
    return Object.values(errors).flatMap((value) =>
      Array.isArray(value) ? value.map((entry) => String(entry)) : [String(value)]
    );
  }

  return [] as string[];
}

function bukApiErrorIncludes(error: unknown, fragments: string[]) {
  const messages = extractBukApiErrorMessages(error).map((message) => normalizeText(message));
  return fragments.some((fragment) => {
    const normalizedFragment = normalizeText(fragment);
    return messages.some((message) => message.includes(normalizedFragment));
  });
}

function isBukDuplicateCreateError(error: unknown) {
  const payload = parseBukApiErrorPayload(toErrorMessage(error));
  const errors = payload?.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
    return false;
  }

  return ["rut", "email", "email_personal"].some((key) => {
    const value = (errors as Record<string, unknown>)[key];
    return Array.isArray(value) && value.some((entry) => normalizeText(String(entry)).includes("ya esta en uso"));
  });
}

function isBukExistingPlanError(error: unknown) {
  return bukApiErrorIncludes(error, [
    "ya existe un plan para este empleado",
    "empleado ya existe un plan para este empleado"
  ]);
}

function extractBukObjectRows(
  payload: unknown,
  collectionKeys: string[] = ["data", "items", "results"]
) {
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

  let sawArray = false;
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    sawArray = true;
    const rows = candidate.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    );

    if (rows.length > 0) {
      return rows;
    }
  }

  return sawArray ? ([] as Record<string, unknown>[]) : [];
}

function compareBukEmployeePriority(left: BukEmployeeRecord, right: BukEmployeeRecord) {
  const leftStatus = normalizeBukEmployeeStatus(left.status);
  const rightStatus = normalizeBukEmployeeStatus(right.status);
  if (leftStatus !== rightStatus) {
    if (leftStatus === "active") return -1;
    if (rightStatus === "active") return 1;
  }

  const leftSequence = parseEmployeeCodeSequence(left.code_sheet) ?? 0;
  const rightSequence = parseEmployeeCodeSequence(right.code_sheet) ?? 0;
  if (leftSequence !== rightSequence) {
    return rightSequence - leftSequence;
  }

  return String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""));
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

async function fetchBukEmployeeByEmail(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const url = new URL(buildBukBaseUrl());
  url.searchParams.set("email", normalizedEmail);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "10");

  const response = await fetchBukJson(url.toString());
  const rows = Array.isArray(response.data) ? response.data : [];
  const exactMatch = rows.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    return normalizeEmail((entry as Record<string, unknown>).email as string | undefined) === normalizedEmail;
  });

  if (exactMatch && typeof exactMatch === "object") {
    return exactMatch as Record<string, unknown>;
  }

  const first = rows[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

async function fetchBukRolesBySearch(search: string) {
  const trimmed = search.trim();
  if (!trimmed) {
    return [] as BukRoleRecord[];
  }

  const url = new URL(buildBukTenantApiUrl("/api/v1/roles"));
  url.searchParams.set("search", trimmed);
  url.searchParams.set("page_size", "100");

  const response = await fetchBukJson(url.toString());
  return extractBukObjectRows(response).filter(
    (entry): entry is BukRoleRecord => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
  );
}

async function fetchBukEmployeePlans(employeeId: string) {
  const url = new URL(`${buildBukBaseUrl().replace(/\/+$/, "")}/${encodeURIComponent(employeeId)}/plans`);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "100");
  const response = await fetchBukJson(url.toString());
  return extractBukObjectRows(response, ["data", "plans", "items", "results"]);
}

async function fetchBukEmployeeJobs(employeeId: string) {
  const url = new URL(`${buildBukBaseUrl().replace(/\/+$/, "")}/${encodeURIComponent(employeeId)}/jobs`);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "100");
  const response = await fetchBukJson(url.toString());
  return extractBukObjectRows(response, ["data", "jobs", "items", "results"]);
}

async function createBukEmployeePlan(employeeId: string, payload: Record<string, unknown>) {
  return fetchBukJson(`${buildBukBaseUrl().replace(/\/+$/, "")}/${encodeURIComponent(employeeId)}/plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function patchBukEmployeePlan(employeeId: string, planId: string | number, payload: Record<string, unknown>) {
  return fetchBukJson(
    `${buildBukBaseUrl().replace(/\/+$/, "")}/${encodeURIComponent(employeeId)}/plans/${encodeURIComponent(String(planId))}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );
}

async function createBukEmployeeJob(employeeId: string, payload: Record<string, unknown>) {
  return fetchBukJson(`${buildBukBaseUrl().replace(/\/+$/, "")}/${encodeURIComponent(employeeId)}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function patchBukEmployeeJob(employeeId: string, jobId: string | number, payload: Record<string, unknown>) {
  return fetchBukJson(
    `${buildBukBaseUrl().replace(/\/+$/, "")}/${encodeURIComponent(employeeId)}/jobs/${encodeURIComponent(String(jobId))}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );
}

async function lookupBukEmployeesByDocumentNumber(payload: BukCandidateSyncPayload) {
  const url = new URL(buildBukBaseUrl());
  url.searchParams.set(
    "document_number",
    normalizeDocumentNumber(payload.profile.document_type, payload.profile.document_number)
  );
  url.searchParams.set("page_size", "100");
  url.searchParams.set("page", "1");

  const response = await fetchBukJson(url.toString());
  return extractBukObjectRows(response)
    .filter((entry): entry is BukEmployeeRecord => Boolean(entry) && typeof entry === "object")
    .sort(compareBukEmployeePriority);
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

function extractCurrentJobSnapshot(rawPayload: Record<string, unknown> | null | undefined): LocalBukJobSnapshot {
  const currentJob =
    rawPayload?.current_job && typeof rawPayload.current_job === "object" && !Array.isArray(rawPayload.current_job)
      ? (rawPayload.current_job as Record<string, unknown>)
      : null;
  const role =
    currentJob?.role && typeof currentJob.role === "object" && !Array.isArray(currentJob.role)
      ? (currentJob.role as Record<string, unknown>)
      : null;
  const boss =
    currentJob?.boss && typeof currentJob.boss === "object" && !Array.isArray(currentJob.boss)
      ? (currentJob.boss as Record<string, unknown>)
      : null;

  return {
    companyId: parseIntegerLike(currentJob?.company_id),
    areaId: parseIntegerLike(currentJob?.area_id),
    roleId: parseIntegerLike(role?.id),
    roleName: typeof role?.name === "string" ? role.name : null,
    costCenter:
      typeof currentJob?.cost_center === "string" && currentJob.cost_center.trim()
        ? currentJob.cost_center.trim()
        : null,
    weeklyHours: parseFiniteNumber(currentJob?.weekly_hours),
    workingScheduleType:
      typeof currentJob?.working_schedule_type === "string" && currentJob.working_schedule_type.trim()
        ? currentJob.working_schedule_type.trim()
        : null,
    otherTypeOfWorkingDay:
      typeof currentJob?.other_type_of_working_day === "string" && currentJob.other_type_of_working_day.trim()
        ? currentJob.other_type_of_working_day.trim()
        : null,
    leaderId: parseIntegerLike(boss?.id)
  };
}

function sortLocalBukEmployees(rows: LocalBukEmployeeRow[]) {
  return [...rows].sort((left, right) => {
    const leftIsActive = normalizeBukEmployeeStatus(left.status) === "active";
    const rightIsActive = normalizeBukEmployeeStatus(right.status) === "active";
    if (leftIsActive !== rightIsActive) {
      return leftIsActive ? -1 : 1;
    }

    return String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
  });
}

function scoreBukRoleCandidate(targetRoleName: string, areaId: number, candidate: BukRoleRecord) {
  const candidateAreaIds = Array.isArray(candidate.area_ids)
    ? candidate.area_ids
        .map((area) => parseIntegerLike(area))
        .filter((value): value is number => value != null)
    : [];
  if (!candidateAreaIds.includes(areaId)) {
    return Number.NEGATIVE_INFINITY;
  }

  const targetCompact = normalizeCompactText(targetRoleName);
  const candidateLabel = candidate.name ?? candidate.code ?? "";
  const candidateCompact = normalizeCompactText(candidateLabel);
  const targetTokens = tokenizeBukLabel(targetRoleName);
  const candidateTokens = new Set(tokenizeBukLabel(candidateLabel));

  let score = 0;
  if (candidateCompact === targetCompact) {
    score += 1000;
  } else if (candidateCompact.includes(targetCompact) || targetCompact.includes(candidateCompact)) {
    score += 500;
  }

  for (const token of targetTokens) {
    if (candidateTokens.has(token)) {
      score += 25;
    }
  }

  return score;
}

async function loadLocalBukAreaEmployees(
  supabase: ReturnType<typeof createClient>,
  areaCode: string
) {
  const { data, error } = await supabase
    .from("employees")
    .select("buk_employee_id, status, raw_payload, updated_at, area_code, area_name")
    .eq("area_code", areaCode)
    .limit(200);

  if (error) {
    throw new Error(`No fue posible leer el cache local de empleados BUK por area ${areaCode}: ${error.message}`);
  }

  return ((data ?? []) as LocalBukEmployeeRow[]).filter((row) => row.raw_payload);
}

async function resolveBukRole(targetRoleName: string, areaId: number) {
  const searchTerms = Array.from(
    new Set([
      targetRoleName.trim(),
      ...tokenizeBukLabel(targetRoleName).slice(0, 1)
    ].filter(Boolean))
  );

  const candidates = (
    await Promise.all(searchTerms.map((term) => fetchBukRolesBySearch(term)))
  ).flat();

  const deduped = Array.from(
    new Map(candidates.map((candidate) => [String(candidate.id), candidate])).values()
  );

  const scoredCandidates = deduped
    .map((candidate) => ({
      candidate,
      score: scoreBukRoleCandidate(targetRoleName, areaId, candidate)
    }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const bestMatch = scoredCandidates[0]?.candidate;
  const roleId = parseIntegerLike(bestMatch?.id);
  if (!bestMatch || roleId == null || !bestMatch.name) {
    throw new Error(`No fue posible resolver el cargo BUK para "${targetRoleName}" en el area ${areaId}.`);
  }

  return {
    roleId,
    roleName: bestMatch.name
  };
}

function buildBukPlanPayload(payload: BukCandidateSyncPayload) {
  const worker = payload.profile.worker_file;
  const pensionScheme = mapBukPensionScheme(worker.pension_regime);
  const healthCompany = mapBukHealthCompany(worker.health_provider);
  const afc = mapBukAfc(worker.afc_regime);
  const quoteIncrease = parseBukBoolean(worker.increase_quote_one_percent);
  const retired = parseBukBoolean(worker.retired_status);
  const planPayload: Record<string, unknown> = {
    pension_scheme: pensionScheme,
    health_company: healthCompany,
    afc,
    retired: retired ?? false
  };

  const fundQuote = mapBukFundQuote(worker.contribution_fund || worker.afp_collection_entity);
  if (fundQuote) {
    planPayload.fund_quote = fundQuote;
  }

  if (worker.pension_regime && normalizeText(worker.pension_regime) === "ips") {
    const collector = normalizeCompactText(worker.afp_collection_entity);
    if (collector) {
      planPayload.afp_collector = `recauda_${collector}`;
    }
  }

  if (quoteIncrease != null) {
    planPayload.quote_increase_one_percent = quoteIncrease;
  }

  if (retired) {
    const regime = parseIntegerLike(worker.retirement_regime);
    if (regime != null) {
      planPayload.retirement_regime = regime;
    }
  }

  return {
    ...planPayload,
    ...buildBukHealthPlanPayload(worker)
  };
}

function buildBukJobPayload(context: CandidateSyncContext) {
  const payload: Record<string, unknown> = {
    company_id: context.companyId,
    start_date: context.startDate,
    type_of_contract: context.contractType,
    area_id: context.areaId,
    role_id: context.roleId,
    leader_id: context.leaderId,
    wage: 0,
    currency: context.currency,
    regular_hours: context.regularHours,
    type_of_working_day: context.typeOfWorkingDay,
    cost_center: context.costCenter,
    contract_subscription_date: context.contractSubscriptionDate,
    custom_attributes: {
      "Bombero en ejercicio": "No",
      Rol: "Rol General"
    }
  };

  if (normalizeText(context.typeOfWorkingDay) === "otros") {
    if (!context.otherTypeOfWorkingDay) {
      throw new Error(
        "No fue posible resolver other_type_of_working_day para una jornada BUK de tipo 'otros'."
      );
    }

    payload.other_type_of_working_day = context.otherTypeOfWorkingDay;
  }

  if (context.contractType === "Plazo fijo") {
    payload.periodicity = context.periodicity;
    if (context.endDate) {
      payload.end_of_contract = context.endDate;
    }
  }

  return payload;
}

function isEquivalentBukPlan(
  existingPlan: Record<string, unknown>,
  desiredPlan: Record<string, unknown>,
  targetStartDate: string
) {
  return (
    extractDatePortion(existingPlan.start_date as string | null | undefined) === targetStartDate &&
    normalizeText(existingPlan.pension_scheme as string | undefined) ===
      normalizeText(desiredPlan.pension_scheme as string | undefined) &&
    normalizeText(existingPlan.health_company as string | undefined) ===
      normalizeText(desiredPlan.health_company as string | undefined) &&
    normalizeText(existingPlan.afc as string | undefined) === normalizeText(desiredPlan.afc as string | undefined)
  );
}

function isEquivalentBukJob(
  existingJob: Record<string, unknown>,
  context: CandidateSyncContext
) {
  const existingRole =
    existingJob.role && typeof existingJob.role === "object" && !Array.isArray(existingJob.role)
      ? (existingJob.role as Record<string, unknown>)
      : null;
  const existingBoss =
    existingJob.boss && typeof existingJob.boss === "object" && !Array.isArray(existingJob.boss)
      ? (existingJob.boss as Record<string, unknown>)
      : null;

  return (
    extractDatePortion(existingJob.start_date as string | null | undefined) === context.startDate &&
    parseIntegerLike(existingJob.company_id) === context.companyId &&
    parseIntegerLike(existingJob.area_id) === context.areaId &&
    parseIntegerLike(existingRole?.id) === context.roleId &&
    parseIntegerLike(existingBoss?.id) === context.leaderId
  );
}

async function resolveCandidateSyncContext(
  supabase: ReturnType<typeof createClient>,
  payload: BukCandidateSyncPayload
) {
  const targetStartDate = resolveTargetStartDate(payload);
  if (!targetStartDate) {
    throw new Error("No fue posible resolver la fecha de inicio del trabajo BUK.");
  }

  const { data: caseRecord, error: caseError } = await supabase
    .from("recruitment_cases")
    .select("id, hiring_request_id, contract_id, contract_name, job_position_name")
    .eq("id", payload.case.id)
    .maybeSingle();

  if (caseError || !caseRecord) {
    throw new Error(`No fue posible cargar el caso de contratacion para sincronizar en BUK: ${caseError?.message ?? "sin caso"}`);
  }

  const { data: hiringRequest, error: hiringRequestError } = await supabase
    .from("hiring_requests")
    .select("id, requester_email, requester_name, contract_number, end_date")
    .eq("id", caseRecord.hiring_request_id)
    .maybeSingle();

  if (hiringRequestError || !hiringRequest) {
    throw new Error(`No fue posible cargar la solicitud aprobada de contratacion para BUK: ${hiringRequestError?.message ?? "sin solicitud"}`);
  }

  let contractMapping: {
    id?: number | null;
    buk_area_name: string | null;
    buk_area_code: string | null;
  } | null = null;

  if (caseRecord.contract_id != null) {
    const { data } = await supabase
      .from("buk_contract_mappings")
      .select("id, buk_area_name, buk_area_code")
      .eq("contract_id", caseRecord.contract_id)
      .limit(1)
      .maybeSingle();
    contractMapping = data;
  }

  if (!contractMapping && typeof hiringRequest.contract_number === "string" && hiringRequest.contract_number.trim()) {
    const { data } = await supabase
      .from("buk_contract_mappings")
      .select("id, buk_area_name, buk_area_code")
      .eq("contract_number", hiringRequest.contract_number.trim())
      .limit(1)
      .maybeSingle();
    contractMapping = data;
  }

  let areaCode = contractMapping?.buk_area_code?.trim() ?? null;
  if (!areaCode) {
    const areaName =
      contractMapping?.buk_area_name?.trim() ??
      caseRecord.contract_name?.trim() ??
      payload.case.contract_name?.trim() ??
      null;

    if (areaName) {
      const { data: resolvedAreaCode, error: resolvedAreaError } = await supabase.rpc(
        "resolve_buk_area_code",
        {
          p_area_name: areaName
        }
      );

      if (resolvedAreaError) {
        throw new Error(
          `No fue posible resolver el area operativa BUK para ${areaName}: ${resolvedAreaError.message}`
        );
      }

      areaCode =
        typeof resolvedAreaCode === "string" && resolvedAreaCode.trim()
          ? resolvedAreaCode.trim()
          : null;

      if (areaCode && contractMapping?.id != null) {
        await supabase
          .from("buk_contract_mappings")
          .update({ buk_area_code: areaCode })
          .eq("id", contractMapping.id);
      }
    }
  }

  if (!areaCode) {
    throw new Error(`No existe un mapping BUK con area operativa para el contrato ${caseRecord.contract_name ?? payload.case.contract_name ?? payload.case.case_code}.`);
  }

  const areaEmployees = sortLocalBukEmployees(await loadLocalBukAreaEmployees(supabase, areaCode));
  const fallbackAreaSnapshot = areaEmployees
    .map((row) => extractCurrentJobSnapshot(row.raw_payload))
    .find((snapshot) => snapshot.areaId != null && snapshot.companyId != null && snapshot.costCenter);

  if (!fallbackAreaSnapshot?.areaId || !fallbackAreaSnapshot.companyId || !fallbackAreaSnapshot.costCenter) {
    throw new Error(`No fue posible resolver area_id/company_id BUK desde el cache local del area operativa ${areaCode}.`);
  }

  const roleResolution = await resolveBukRole(
    caseRecord.job_position_name ?? payload.case.job_position_name ?? "",
    fallbackAreaSnapshot.areaId
  );

  const matchingRoleSample = areaEmployees
    .map((row) => extractCurrentJobSnapshot(row.raw_payload))
    .find((snapshot) => snapshot.roleId === roleResolution.roleId);

  const requesterBukEmployee = await fetchBukEmployeeByEmail(hiringRequest.requester_email);
  const requesterCompanyId =
    requesterBukEmployee && typeof requesterBukEmployee === "object"
      ? parseIntegerLike(
          requesterBukEmployee.current_job &&
            typeof requesterBukEmployee.current_job === "object" &&
            !Array.isArray(requesterBukEmployee.current_job)
            ? (requesterBukEmployee.current_job as Record<string, unknown>).company_id
            : null
        )
      : null;
  const requesterLeaderId =
    requesterBukEmployee && typeof requesterBukEmployee === "object"
      ? parseIntegerLike(requesterBukEmployee.id)
      : null;

  const worker = payload.profile.worker_file;
  return {
    areaCode,
    areaName: contractMapping?.buk_area_name ?? caseRecord.contract_name ?? payload.case.contract_name,
    companyId: matchingRoleSample?.companyId ?? fallbackAreaSnapshot.companyId ?? requesterCompanyId ?? 0,
    areaId: matchingRoleSample?.areaId ?? fallbackAreaSnapshot.areaId,
    costCenter: matchingRoleSample?.costCenter ?? fallbackAreaSnapshot.costCenter,
    leaderId: requesterLeaderId ?? matchingRoleSample?.leaderId ?? fallbackAreaSnapshot.leaderId ?? 0,
    roleId: roleResolution.roleId,
    roleName: roleResolution.roleName,
    wage: 0,
    currency: mapBukCurrency(worker.currency),
    contractType: hiringRequest.end_date ? "Plazo fijo" : "Indefinido",
    periodicity: mapBukPeriodicity(worker.payment_period),
    regularHours: matchingRoleSample?.weeklyHours ?? fallbackAreaSnapshot.weeklyHours ?? 42,
    typeOfWorkingDay:
      matchingRoleSample?.workingScheduleType ??
      fallbackAreaSnapshot.workingScheduleType ??
      "ordinaria_art_22",
    otherTypeOfWorkingDay:
      matchingRoleSample?.otherTypeOfWorkingDay ??
      fallbackAreaSnapshot.otherTypeOfWorkingDay ??
      null,
    startDate: targetStartDate,
    endDate: hiringRequest.end_date ?? null,
    contractSubscriptionDate: targetStartDate,
    planPayload: buildBukPlanPayload(payload)
  } satisfies CandidateSyncContext;
}

async function ensureBukEmployeeSetup(
  supabase: ReturnType<typeof createClient>,
  payload: BukCandidateSyncPayload,
  employeeId: string
) {
  const context = await resolveCandidateSyncContext(supabase, payload);
  if (!context.companyId || !context.areaId || !context.leaderId) {
    throw new Error("No fue posible resolver company_id, area_id o leader_id para crear el trabajo en BUK.");
  }

  const plans = await fetchBukEmployeePlans(employeeId);
  const matchingPlan =
    plans.find((plan) => isEquivalentBukPlan(plan, context.planPayload, context.startDate)) ??
    plans.find((plan) => extractDatePortion(plan.start_date as string | null | undefined) === context.startDate) ??
    null;

  let planResponse: Record<string, unknown> | null = null;
  if (!matchingPlan) {
    try {
      const createdPlan = await createBukEmployeePlan(employeeId, context.planPayload);
      planResponse =
        createdPlan.data && typeof createdPlan.data === "object"
          ? (createdPlan.data as Record<string, unknown>)
          : createdPlan;
    } catch (error) {
      if (!isBukExistingPlanError(error)) {
        throw error;
      }

      const recoveredPlans = await fetchBukEmployeePlans(employeeId);
      const recoveredPlan =
        recoveredPlans.find((plan) => isEquivalentBukPlan(plan, context.planPayload, context.startDate)) ??
        recoveredPlans.find((plan) => extractDatePortion(plan.start_date as string | null | undefined) === context.startDate) ??
        null;

      planResponse =
        recoveredPlan ??
        {
          recoveredFromDuplicateError: true,
          duplicateError: toErrorMessage(error),
          start_date: context.startDate
        };
    }
  } else if (!isEquivalentBukPlan(matchingPlan, context.planPayload, context.startDate)) {
    const patchedPlan = await patchBukEmployeePlan(employeeId, matchingPlan.id as string | number, context.planPayload);
    planResponse =
      patchedPlan.data && typeof patchedPlan.data === "object"
        ? (patchedPlan.data as Record<string, unknown>)
        : patchedPlan;
  } else {
    planResponse = matchingPlan;
  }

  const jobPayload = buildBukJobPayload(context);
  const jobs = await fetchBukEmployeeJobs(employeeId);
  const matchingJob =
    jobs.find((job) => isEquivalentBukJob(job, context)) ??
    jobs.find((job) => extractDatePortion(job.start_date as string | null | undefined) === context.startDate) ??
    null;

  let jobResponse: Record<string, unknown> | null = null;
  if (!matchingJob) {
    const createdJob = await createBukEmployeeJob(employeeId, jobPayload);
    jobResponse =
      createdJob.data && typeof createdJob.data === "object"
        ? (createdJob.data as Record<string, unknown>)
        : createdJob;
  } else if (
    !isEquivalentBukJob(matchingJob, context) ||
    parseFiniteNumber(matchingJob.base_wage) !== 0
  ) {
    const patchedJob = await patchBukEmployeeJob(employeeId, matchingJob.id as string | number, jobPayload);
    jobResponse =
      patchedJob.data && typeof patchedJob.data === "object"
        ? (patchedJob.data as Record<string, unknown>)
        : patchedJob;
  } else {
    jobResponse = matchingJob;
  }

  return {
    context,
    planPayload: context.planPayload,
    planResponse,
    jobPayload,
    jobResponse
  };
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
    code_sheet: resolveBukEmployeeCode(payload),
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

function buildBukEmployeeClonePayload(
  payload: BukCandidateSyncPayload,
  employees: BukEmployeeRecord[]
) {
  const worker = payload.profile.worker_file;

  return {
    payment_method: worker.payment_method ?? undefined,
    payment_period: worker.payment_period ?? undefined,
    bank: worker.bank_name ?? undefined,
    account_type: worker.bank_account_type ?? undefined,
    account_number: worker.bank_account_number ?? undefined,
    code_sheet: resolveNextBukEmployeeCode(payload, employees) ?? resolveBukEmployeeCode(payload) ?? undefined,
    start_date: resolveTargetStartDate(payload) ?? undefined,
    private_role: resolvePrivateRole(worker.private_role)
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

async function cloneBukEmployee(
  payload: BukCandidateSyncPayload,
  referenceEmployee: BukEmployeeRecord,
  employees: BukEmployeeRecord[]
) {
  const clonePayload = buildBukEmployeeClonePayload(payload, employees);
  const response = await fetchBukJson(`${buildBukBaseUrl()}/${referenceEmployee.id}/clone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(clonePayload)
  });

  const employeeId =
    response.employee?.id ??
    response.data?.id ??
    response.id ??
    null;

  if (!employeeId) {
    throw new Error("Buk no retornó el identificador de la ficha clonada");
  }

  return {
    employeeId: String(employeeId),
    employeePayload: clonePayload,
    clonedFromEmployeeId: String(referenceEmployee.id)
  };
}

async function resolveBukEmployeeForSync(
  payload: BukCandidateSyncPayload,
  locations: BukLocation[]
) {
  try {
    const created = await createBukEmployee(payload, locations);
    return {
      employeeId: created.employeeId,
      employeePayload: created.employeePayload,
      resolution: "created"
    } as const;
  } catch (error) {
    if (!isBukDuplicateCreateError(error)) {
      throw error;
    }

    const matchingEmployees = await lookupBukEmployeesByDocumentNumber(payload);
    if (matchingEmployees.length === 0) {
      throw error;
    }

    const erpProvisionedEmployee = matchingEmployees.find((employee) =>
      isErpProvisionedActiveBukEmployee(employee, payload)
    );
    if (erpProvisionedEmployee) {
      return {
        employeeId: String(erpProvisionedEmployee.id),
        employeePayload: null,
        resolution: "reused_existing_active",
        matchedEmployee: erpProvisionedEmployee
      } as const;
    }

    const activeEmployee = matchingEmployees.find((employee) =>
      isActiveBukEmployeeDuplicate(employee, payload)
    );
    if (activeEmployee) {
      return {
        employeeId: String(activeEmployee.id),
        employeePayload: null,
        resolution: "existing_active_duplicate",
        matchedEmployee: activeEmployee
      } as const;
    }

    const inactiveEmployee = matchingEmployees.find((employee) =>
      isInactiveBukEmployee(employee, payload)
    );
    if (inactiveEmployee) {
      if (isReusableIncompleteBukEmployee(inactiveEmployee, payload)) {
        return {
          employeeId: String(inactiveEmployee.id),
          employeePayload: null,
          resolution: "reused_incomplete_existing",
          matchedEmployee: inactiveEmployee
        } as const;
      }

      const cloned = await cloneBukEmployee(payload, inactiveEmployee, matchingEmployees);
      return {
        employeeId: cloned.employeeId,
        employeePayload: cloned.employeePayload,
        resolution: "cloned_existing_inactive",
        matchedEmployee: inactiveEmployee,
        clonedFromEmployeeId: cloned.clonedFromEmployeeId
      } as const;
    }

    const matchedEmployee = matchingEmployees[0];
    throw new Error(
      `El trabajador ya existe en BUK (ID ${matchedEmployee.id}, estado ${matchedEmployee.status ?? "desconocido"}) y no fue posible resolver la ficha automáticamente.`
    );
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
    const { bukDocumentId, bukDocumentUrl, bukEmployeeFolderId } = extractBukDocumentMetadata(uploadPayload);

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
      bukEmployeeFolderId,
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

async function finalizeExistingActiveEmployeeJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  employeeId: string,
  resultSnapshot: Record<string, unknown>
) {
  const { error } = await supabase.rpc("finalize_buk_sync_job_existing_active_employee", {
    p_job_id: jobId,
    p_existing_buk_employee_id: employeeId,
    p_result_snapshot: resultSnapshot
  });

  if (error) {
    throw new Error(
      `No fue posible cerrar el job BUK ${jobId} para un trabajador ya activo en BUK: ${error.message}`
    );
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
        const resolvedEmployee = await resolveBukEmployeeForSync(payload, locations);
        const employeeId = resolvedEmployee.employeeId;
        jobResultSnapshot.employee = {
          id: employeeId,
          request: resolvedEmployee.employeePayload,
          resolution: resolvedEmployee.resolution,
          matchedEmployee: resolvedEmployee.matchedEmployee ?? null,
          clonedFromEmployeeId: resolvedEmployee.clonedFromEmployeeId ?? null
        };

        if (resolvedEmployee.resolution === "existing_active_duplicate") {
          jobResultSnapshot.erpAction = {
            action: "cancel_request_existing_active_buk_employee",
            comment: "El trabajador ya existe activo en BUK; la pedida ERP fue anulada."
          };
          await finalizeExistingActiveEmployeeJob(supabase, job.id, employeeId, jobResultSnapshot);
        } else {
          const setupResult = await ensureBukEmployeeSetup(supabase, payload, employeeId);
          jobResultSnapshot.plan = {
            request: setupResult.planPayload,
            response: setupResult.planResponse
          };
          jobResultSnapshot.job = {
            request: setupResult.jobPayload,
            response: setupResult.jobResponse,
            resolvedContext: {
              areaCode: setupResult.context.areaCode,
              areaName: setupResult.context.areaName,
              areaId: setupResult.context.areaId,
              companyId: setupResult.context.companyId,
              roleId: setupResult.context.roleId,
              roleName: setupResult.context.roleName,
              leaderId: setupResult.context.leaderId,
              costCenter: setupResult.context.costCenter,
              wage: setupResult.context.wage
            }
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
        }

        results.push({
          jobId: job.id,
          candidateId: job.recruitment_case_candidate_id,
          status: "success",
          bukEmployeeId: employeeId,
          resolution: resolvedEmployee.resolution
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
