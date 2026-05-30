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

function getAreasBaseUrl(env) {
  const url = new URL(env.BUK_EMPLOYEES_URL);
  url.pathname = url.pathname.replace(/\/employees$/, "/organization/areas");
  url.search = "";
  return url.toString();
}

async function fetchBukAreas(env) {
  const areaLookup = new Map();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = new URL(env.BUK_AREAS_URL ?? getAreasBaseUrl(env));
    url.searchParams.set("status", "both");
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "100");

    const response = await fetchWithRetry(url, {
      headers: {
        auth_token: env.BUK_AUTH_TOKEN,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const payload = await response.json();
    const data = Array.isArray(payload?.data) ? payload.data : [];
    totalPages = Number(payload?.pagination?.total_pages ?? totalPages ?? 1);

    for (const area of data) {
      if (!area?.id) continue;
      const humanName = area.second_level_name ?? area.parent_area?.name ?? area.name ?? null;
      const displayName = humanName && area.name && humanName !== area.name ? `${humanName} (${area.name})` : humanName;
      areaLookup.set(String(area.id), {
        id: area.id,
        name: displayName ?? area.name ?? null,
        cost_center: area.cost_center ?? null,
      });
    }

    page += 1;
  }

  return areaLookup;
}

async function main() {
  const env = readEnvFile();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const areaLookup = await fetchBukAreas(env);

  let page = 1;
  let totalPages = 1;
  let synced = 0;

  while (page <= totalPages) {
    const url = new URL(env.BUK_EMPLOYEES_URL);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "100");

    const response = await fetchWithRetry(url, {
      headers: {
        auth_token: env.BUK_AUTH_TOKEN,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const payload = await response.json();
    const data = Array.isArray(payload?.data) ? payload.data : [];
    totalPages = Number(payload?.pagination?.total_pages ?? totalPages ?? 1);
    const employees = data.map((employee) => normalizeBukEmployee(employee, areaLookup)).filter(Boolean);

    if (employees.length > 0) {
      const { error } = await supabase.from("employees").upsert(employees, {
        onConflict: "buk_employee_id",
      });

      if (error) {
        throw error;
      }

      synced += employees.length;
    }

    console.log(`Page ${page}/${totalPages}: synced ${employees.length} employees`);
    page += 1;
  }

  const { count, error } = await supabase.from("employees").select("id", { count: "exact", head: true });
  if (error) {
    throw error;
  }

  console.log(JSON.stringify({ ok: true, synced, finalCount: count }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
