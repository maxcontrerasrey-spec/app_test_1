import fs from "fs";

import { createClient } from "@supabase/supabase-js";

function normalizeText(value) {
  return (value ?? "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function readEnvFile() {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split(/\n+/)
        .filter(Boolean)
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
  } catch (error) {
    return process.env;
  }
}

function requireEnv(value, label) {
  const normalized = (value ?? "").toString().trim();

  if (!normalized) {
    throw new Error(`${label} is missing.`);
  }

  return normalized;
}

function optionalEnv(value) {
  const normalized = (value ?? "").toString().trim();
  return normalized || null;
}

function getFullName(employee) {
  const parts = [
    employee.full_name,
    employee.name,
    employee.short_name,
    [employee.first_name, employee.surname].filter(Boolean).join(" "),
  ].filter(Boolean);

  return parts[0] ?? null;
}

function getJobTitle(employee) {
  return employee.job_title ?? employee.position_name ?? employee.position?.name ?? employee.role_name ?? null;
}

function getCurrentJob(employee) {
  return employee.current_job ?? employee.jobs?.[employee.jobs.length - 1] ?? null;
}

function getCurrentAreaId(employee) {
  return getCurrentJob(employee)?.area_id ?? null;
}

function getCurrentJobCustomAttribute(employee, key) {
  return getCurrentJob(employee)?.custom_attributes?.[key] ?? null;
}

function derivePilotAreaName(employee) {
  const normalizedDenomination = normalizeText(getCurrentJobCustomAttribute(employee, "Número y denominación actual"));

  if (!normalizedDenomination) {
    return null;
  }

  if (normalizedDenomination.includes("ministro hales") || normalizedDenomination.includes(" dmh")) {
    return "SERVICIO CODELCO DMH";
  }

  if (normalizedDenomination.includes(" drt") || normalizedDenomination.includes("radomiro tomic")) {
    return "CODELCO DRT";
  }

  return null;
}

function getEmail(employee) {
  return employee.email ?? employee.personal_email ?? employee.work_email ?? null;
}

function getStatus(employee) {
  return employee.status ?? employee.employee_status ?? employee.current_state ?? null;
}

function parseDateValue(value) {
  if (!value) return null;
  const raw = value.toString().trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
  }

  return null;
}

function getBirthDate(employee) {
  return parseDateValue(
    employee.birthday ??
      employee.birth_date ??
      employee.birthdate ??
      employee.date_of_birth ??
      employee.personal_information?.birthday ??
      employee.personal_information?.birth_date ??
      employee.personal_information?.date_of_birth ??
      employee.document?.birthday ??
      null,
  );
}

function getContractCode(employee) {
  const currentJob = getCurrentJob(employee);
  return (
    employee.contract_code ??
    getCurrentJobCustomAttribute(employee, "Código Área Funcional") ??
    currentJob?.cost_center ??
    employee.company?.code ??
    employee.area?.code ??
    null
  );
}

function getAreaName(employee, areaLookup) {
  const currentJob = getCurrentJob(employee);
  const resolvedArea = areaLookup.get(String(getCurrentAreaId(employee)));
  return (
    resolvedArea?.name ??
    derivePilotAreaName(employee) ??
    employee.area_name ??
    getCurrentJobCustomAttribute(employee, "Área Funcional") ??
    currentJob?.area?.name ??
    employee.area?.name ??
    employee.department?.name ??
    null
  );
}

function getAreaCode(employee, areaLookup) {
  const currentJob = getCurrentJob(employee);
  return (
    areaLookup.get(String(getCurrentAreaId(employee)))?.cost_center ??
    employee.area_code ??
    currentJob?.custom_attributes?.["Código Área Funcional"] ??
    currentJob?.area?.code ??
    currentJob?.area_id ??
    currentJob?.cost_center ??
    employee.area?.code ??
    employee.department?.code ??
    null
  );
}

function getDocumentNumber(employee) {
  return employee.document_number ?? employee.rut ?? employee.document?.number ?? null;
}

function getDocumentType(employee) {
  return employee.document_type ?? employee.document?.type ?? (employee.rut ? "rut" : null);
}

function getBukId(employee) {
  return employee.id ?? employee.employee_id ?? employee.code ?? null;
}

function inferActive(status) {
  const normalized = (status ?? "").toString().trim().toLowerCase();
  if (!normalized) return true;

  return !["terminated", "inactive", "disabled", "desvinculado", "inactivo"].includes(normalized);
}

function normalizeBukEmployee(employee, areaLookup = new Map()) {
  const bukEmployeeId = getBukId(employee);
  const fullName = getFullName(employee);

  if (!bukEmployeeId || !fullName) {
    return null;
  }

  const status = getStatus(employee);

  return {
    buk_employee_id: String(bukEmployeeId),
    full_name: fullName,
    email: getEmail(employee),
    job_title: getJobTitle(employee),
    contract_code: getContractCode(employee),
    area_name: getAreaName(employee, areaLookup),
    area_code: getAreaCode(employee, areaLookup),
    document_number: getDocumentNumber(employee),
    document_type: getDocumentType(employee),
    birth_date: getBirthDate(employee),
    status,
    is_active: inferActive(status),
    raw_payload: employee,
  };
}

async function fetchWithRetry(url, options, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Buk sync failed with status ${response.status}.`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Buk fetch failed.");
}

function isStatementTimeoutError(error) {
  if (!error) return false;

  const code = (error.code ?? "").toString().trim();
  const message = (error.message ?? "").toString().toLowerCase();

  return code === "57014" || message.includes("statement timeout");
}

async function runSupabaseOperationWithRetry(
  label,
  operation,
  { retries = 3, baseDelayMs = 1200 } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const result = await operation();
      const resultError =
        result && typeof result === "object" && "error" in result ? result.error : null;

      if (resultError) {
        throw resultError;
      }

      return result;
    } catch (error) {
      lastError = error;

      if (!isStatementTimeoutError(error) || attempt === retries) {
        throw error;
      }

      console.warn(
        `[sync-buk] ${label} timed out on attempt ${attempt}/${retries}. Retrying...`,
      );
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed.`);
}

function getEmployeesBaseUrl(env) {
  return optionalEnv(env.BUK_EMPLOYEES_URL) ?? "https://busesjm.buk.cl/api/v1/chile/employees";
}

function getAreasBaseUrl(env) {
  const url = new URL(getEmployeesBaseUrl(env));
  url.pathname = url.pathname.replace(/\/employees$/, "/organization/areas");
  url.search = "";
  return url.toString();
}

async function fetchBukEmployeesPage(env, page = 1) {
  const authToken = env.BUK_AUTH_TOKEN;

  if (!authToken) {
    throw new Error("BUK_AUTH_TOKEN is missing.");
  }

  const url = new URL(getEmployeesBaseUrl(env));
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", "100");

  const response = await fetchWithRetry(url, {
    headers: {
      auth_token: authToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payload = await response.json();
  const data = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  const meta = payload?.meta ?? {};
  const pagination = payload?.pagination ?? {};
  const nextPageUrl = pagination.next ?? null;
  const nextPage =
    nextPageUrl && typeof nextPageUrl === "string"
      ? Number(new URL(nextPageUrl).searchParams.get("page"))
      : meta.next_page ?? null;
  const totalPages = Number(pagination.total_pages ?? meta.total_pages ?? 0);

  return {
    rawEmployees: data,
    nextPage: nextPage || null,
    totalPages,
    page,
    rawCount: data.length,
  };
}

async function fetchBukAreasPage(env, page = 1) {
  const authToken = env.BUK_AUTH_TOKEN;

  if (!authToken) {
    throw new Error("BUK_AUTH_TOKEN is missing.");
  }

  const url = new URL(optionalEnv(env.BUK_AREAS_URL) ?? getAreasBaseUrl(env));
  url.searchParams.set("status", "both");
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", "100");

  const response = await fetchWithRetry(url, {
    headers: {
      auth_token: authToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payload = await response.json();
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const pagination = payload?.pagination ?? {};
  const nextPageUrl = pagination.next ?? null;
  const nextPage = nextPageUrl && typeof nextPageUrl === "string" ? Number(new URL(nextPageUrl).searchParams.get("page")) : null;
  const totalPages = Number(pagination.total_pages ?? 0);

  return {
    areas: data,
    nextPage: nextPage || null,
    totalPages,
    rawCount: data.length,
  };
}

async function fetchBukAreas(env) {
  const areaLookup = new Map();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchBukAreasPage(env, page);

    for (const area of result.areas) {
      if (!area?.id) continue;
      const humanName = area.second_level_name ?? area.parent_area?.name ?? area.name ?? null;
      const displayName = humanName && area.name && humanName !== area.name ? `${humanName} (${area.name})` : humanName;
      areaLookup.set(String(area.id), {
        id: area.id,
        name: displayName ?? area.name ?? null,
        cost_center: area.cost_center ?? null,
      });
    }

    if (result.nextPage) {
      page = result.nextPage;
      hasMore = result.rawCount > 0;
    } else if (result.totalPages > 0 && page < result.totalPages) {
      page += 1;
      hasMore = true;
    } else if (result.rawCount === 100) {
      page += 1;
      hasMore = true;
    } else {
      hasMore = false;
    }
  }

  return areaLookup;
}

async function main() {
  const env = readEnvFile();
  const supabaseUrl = requireEnv(
    env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    "Missing Supabase URL. Expected VITE_SUPABASE_URL, SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
  );
  const serviceRoleKey = requireEnv(env.SUPABASE_SERVICE_ROLE_KEY ?? null, "SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const areaLookup = await fetchBukAreas(env);

  let page = 1;
  let hasMore = true;
  let synced = 0;
  let pagesProcessed = 0;

  while (hasMore) {
    const result = await fetchBukEmployeesPage(env, page);
    const employees = result.rawEmployees.map((employee) => normalizeBukEmployee(employee, areaLookup)).filter(Boolean);
    pagesProcessed += 1;

    if (employees.length > 0) {
      const { error } = await supabase.from("employees").upsert(employees, {
        onConflict: "buk_employee_id",
      });

      if (error) {
        throw error;
      }

      synced += employees.length;
    }

    console.log(`Page ${page}/${result.totalPages || "?"}: synced ${employees.length} employees`);

    if (result.nextPage) {
      page = result.nextPage;
      hasMore = result.rawCount > 0;
    } else if (result.totalPages > 0 && page < result.totalPages) {
      page += 1;
      hasMore = true;
    } else if (result.rawCount === 100) {
      page += 1;
      hasMore = true;
    } else {
      hasMore = false;
    }
  }

  const { count, error } = await runSupabaseOperationWithRetry(
    "employees total count",
    async () => supabase.from("employees").select("id", { count: "planned", head: true }),
  );
  if (error) throw error;

  const { count: activeCount, error: activeCountError } = await runSupabaseOperationWithRetry(
    "employees active count",
    async () =>
      supabase
        .from("employees")
        .select("id", { count: "planned", head: true })
        .eq("is_active", true),
  );
  if (activeCountError) throw activeCountError;

  const snapshotDate = new Date().toISOString().slice(0, 10);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const { data: snapshotResult, error: snapshotError } = await runSupabaseOperationWithRetry(
    "daily BUK snapshot",
    async () =>
      supabase.rpc("capture_buk_employee_daily_snapshot", {
        p_snapshot_date: snapshotDate,
      }),
    { retries: 5, baseDelayMs: 5000 },
  );
  if (snapshotError) throw snapshotError;

  console.log(
    JSON.stringify(
      {
        ok: true,
        pagesProcessed,
        synced,
        snapshotDate,
        finalCount: count,
        activeCount,
        snapshotRowsAffected: Number(snapshotResult ?? 0),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
