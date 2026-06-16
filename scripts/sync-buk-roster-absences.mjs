import fs from "fs";

import { createClient } from "@supabase/supabase-js";

const DEFAULT_LOOKAHEAD_DAYS = 180;
const PAGE_SIZE = 100;
const CONCURRENCY = 6;
const SUPABASE_RPC_CONCURRENCY = 12;
const SUPABASE_PAGE_SIZE = 1000;
const BUK_EXCEPTION_TYPES = new Set(["vacation", "medical_leave"]);

function formatErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    return JSON.stringify(error);
  }

  return String(error);
}

function readEnvFile() {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split(/\n+/)
        .filter(Boolean)
        .filter((line) => !line.trim().startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
  } catch {
    return {};
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

function parseArgs(argv) {
  const today = new Date();
  const from = formatDate(today);
  const to = formatDate(addDays(today, DEFAULT_LOOKAHEAD_DAYS));
  const options = {
    from,
    to,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--from") {
      options.from = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--to") {
      options.to = argv[index + 1];
      index += 1;
    }
  }

  assertDate(options.from, "--from");
  assertDate(options.to, "--to");

  if (options.from > options.to) {
    throw new Error("--from no puede ser posterior a --to.");
  }

  return options;
}

function assertDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} debe usar formato YYYY-MM-DD.`);
  }
}

function addDays(date, days) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  if (!value) return null;
  const raw = value.toString().trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
  return null;
}

function normalizeText(value) {
  return (value ?? "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getBukApiBaseUrl(env) {
  const employeesUrl = (optionalEnv(env.BUK_EMPLOYEES_URL) ?? "https://busesjm.buk.cl/api/v1/chile/employees").trim();
  return employeesUrl.replace(/\/employees\/?$/, "");
}

async function fetchWithRetry(url, authToken, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          auth_token: authToken,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`BUK ${url} failed with status ${response.status}: ${body.slice(0, 180)}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("BUK fetch failed.");
}

function getPagination(payload, page) {
  const meta = payload?.meta ?? {};
  const pagination = payload?.pagination ?? {};
  const nextPageUrl = pagination.next ?? meta.next ?? null;
  const nextPage = nextPageUrl && typeof nextPageUrl === "string" ? Number(new URL(nextPageUrl).searchParams.get("page")) : null;
  const totalPages = Number(pagination.total_pages ?? meta.total_pages ?? 0);

  return {
    nextPage: Number.isFinite(nextPage) && nextPage > page ? nextPage : null,
    totalPages: Number.isFinite(totalPages) ? totalPages : 0,
  };
}

async function fetchBukPage(baseUrl, authToken, endpoint, page) {
  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(PAGE_SIZE));

  const payload = await fetchWithRetry(url, authToken);
  const data = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];

  return {
    data,
    page,
    ...getPagination(payload, page),
  };
}

async function fetchBukCollection(baseUrl, authToken, endpoint) {
  const firstPage = await fetchBukPage(baseUrl, authToken, endpoint, 1);
  const rows = [...firstPage.data];
  let pagesProcessed = 1;

  if (firstPage.totalPages > 1) {
    const pendingPages = [];
    for (let page = 2; page <= firstPage.totalPages; page += 1) {
      pendingPages.push(page);
    }

    for (let index = 0; index < pendingPages.length; index += CONCURRENCY) {
      const batch = pendingPages.slice(index, index + CONCURRENCY);
      const results = await Promise.all(batch.map((page) => fetchBukPage(baseUrl, authToken, endpoint, page)));
      for (const result of results) {
        rows.push(...result.data);
        pagesProcessed += 1;
      }
    }
  } else {
    let nextPage = firstPage.nextPage;
    let guard = 0;
    while (nextPage && guard < 500) {
      const result = await fetchBukPage(baseUrl, authToken, endpoint, nextPage);
      rows.push(...result.data);
      pagesProcessed += 1;
      nextPage = result.nextPage;
      guard += 1;
    }
  }

  return {
    rows,
    pagesProcessed,
  };
}

function isApprovedStatus(status) {
  const normalized = normalizeText(status);
  return ["approved", "accepted", "active", "confirmed", "aprobado", "aceptado", "vigente", "confirmado"].includes(normalized);
}

function getEmployeeId(record) {
  return record.employee_id ?? record.employee?.id ?? record.person_id ?? record.employee?.person_id ?? null;
}

function getDateRange(record) {
  return {
    start: parseDate(record.start_date ?? record.started_at ?? record.from ?? record.initial_date),
    end: parseDate(record.end_date ?? record.ended_at ?? record.to ?? record.final_date ?? record.start_date),
  };
}

function getMedicalLeaveType(record) {
  const normalizedType = normalizeText(record.type ?? record.absence_type ?? record.licence_type ?? record.license_type);
  const normalizedReason = normalizeText(record.reason ?? record.licence_type ?? record.license_type ?? record.name);

  if (
    ["licence", "license", "medical_leave", "licencia", "licencia medica", "licencia medica electronica"].includes(normalizedType) ||
    normalizedType.includes("licenc") ||
    normalizedReason.includes("licenc") ||
    normalizedReason.includes("medic")
  ) {
    return "medical_leave";
  }

  return null;
}

function* eachDateInRange(start, end) {
  let cursor = new Date(`${start}T00:00:00.000Z`);
  const limit = new Date(`${end}T00:00:00.000Z`);

  while (cursor <= limit) {
    yield formatDate(cursor);
    cursor = addDays(cursor, 1);
  }
}

function addDesiredException(desiredByEmployeeDate, record, exceptionType, syncWindow) {
  const bukEmployeeId = getEmployeeId(record);
  const { start, end } = getDateRange(record);

  if (!bukEmployeeId || !start || !end || !isApprovedStatus(record.status)) {
    return false;
  }

  const effectiveStart = start < syncWindow.from ? syncWindow.from : start;
  const effectiveEnd = end > syncWindow.to ? syncWindow.to : end;

  if (effectiveStart > effectiveEnd) {
    return false;
  }

  for (const exceptionDate of eachDateInRange(effectiveStart, effectiveEnd)) {
    const key = `${bukEmployeeId}|${exceptionDate}`;
    const existing = desiredByEmployeeDate.get(key);
    const next = {
      bukEmployeeId: String(bukEmployeeId),
      exceptionDate,
      exceptionType,
      sourceRecordId: record.id ?? null,
      status: record.status ?? null,
    };

    if (!existing || exceptionType === "medical_leave") {
      desiredByEmployeeDate.set(key, next);
    }
  }

  return true;
}

function buildDesiredExceptions(vacations, absences, syncWindow) {
  const desiredByEmployeeDate = new Map();
  let acceptedVacationRecords = 0;
  let acceptedMedicalLeaveRecords = 0;
  let skippedAbsenceRecords = 0;

  for (const vacation of vacations) {
    if (addDesiredException(desiredByEmployeeDate, vacation, "vacation", syncWindow)) {
      acceptedVacationRecords += 1;
    }
  }

  for (const absence of absences) {
    const exceptionType = getMedicalLeaveType(absence);
    if (!exceptionType) {
      skippedAbsenceRecords += 1;
      continue;
    }

    if (addDesiredException(desiredByEmployeeDate, absence, exceptionType, syncWindow)) {
      acceptedMedicalLeaveRecords += 1;
    }
  }

  return {
    desired: [...desiredByEmployeeDate.values()],
    desiredKeys: new Set([...desiredByEmployeeDate.values()].map((entry) => `${entry.bukEmployeeId}|${entry.exceptionDate}`)),
    acceptedVacationRecords,
    acceptedMedicalLeaveRecords,
    skippedAbsenceRecords,
  };
}

async function fetchExistingBukExceptions(supabase, syncWindow) {
  const exceptions = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("hr_roster_exceptions")
      .select("id, employee_buk_employee_id, exception_date, exception_type")
      .eq("exception_source", "buk")
      .eq("is_active", true)
      .in("exception_type", [...BUK_EXCEPTION_TYPES])
      .gte("exception_date", syncWindow.from)
      .lte("exception_date", syncWindow.to)
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    exceptions.push(...(data ?? []));

    if (!data || data.length < SUPABASE_PAGE_SIZE) {
      break;
    }

    from += SUPABASE_PAGE_SIZE;
  }

  return exceptions
    .map((exception) => ({
      ...exception,
      bukEmployeeId: exception.employee_buk_employee_id ?? null,
    }))
    .filter((exception) => exception.bukEmployeeId);
}

async function fetchActiveBukEmployeeIds(supabase) {
  const employees = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("employees_active_current")
      .select("buk_employee_id")
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    employees.push(...(data ?? []));

    if (!data || data.length < SUPABASE_PAGE_SIZE) {
      break;
    }

    from += SUPABASE_PAGE_SIZE;
  }

  return new Set(employees.map((employee) => String(employee.buk_employee_id)).filter(Boolean));
}

async function syncException(supabase, entry) {
  const { error } = await supabase.rpc("sync_hr_roster_exception_from_buk", {
    p_buk_employee_id: entry.bukEmployeeId,
    p_exception_date: entry.exceptionDate,
    p_exception_type: entry.exceptionType,
    p_notes: `BUK ${entry.exceptionType}${entry.sourceRecordId ? ` #${entry.sourceRecordId}` : ""}${entry.status ? ` (${entry.status})` : ""}`,
  });

  if (error) {
    throw error;
  }
}

async function clearException(supabase, entry) {
  const { error } = await supabase.rpc("sync_hr_roster_exception_from_buk", {
    p_buk_employee_id: entry.bukEmployeeId,
    p_exception_date: entry.exception_date,
    p_exception_type: null,
    p_notes: "BUK ya no reporta vacaciones/licencia médica activa para esta fecha.",
  });

  if (error) {
    throw error;
  }
}

async function runLimited(entries, worker, summaryKey) {
  const summary = {
    [summaryKey]: 0,
    failed: [],
  };

  for (let index = 0; index < entries.length; index += SUPABASE_RPC_CONCURRENCY) {
    const batch = entries.slice(index, index + SUPABASE_RPC_CONCURRENCY);
    const results = await Promise.allSettled(batch.map((entry) => worker(entry)));

    results.forEach((result, resultIndex) => {
      const entry = batch[resultIndex];
      if (result.status === "fulfilled") {
        summary[summaryKey] += 1;
        return;
      }

      summary.failed.push({
        bukEmployeeId: entry.bukEmployeeId,
        exceptionDate: entry.exceptionDate ?? entry.exception_date,
        exceptionType: entry.exceptionType ?? entry.exception_type,
        message: formatErrorMessage(result.reason),
      });
    });
  }

  return summary;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = { ...readEnvFile(), ...process.env };
  const authToken = requireEnv(env.BUK_AUTH_TOKEN, "BUK_AUTH_TOKEN");
  const supabaseUrl = requireEnv(
    env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    "Missing Supabase URL. Expected VITE_SUPABASE_URL, SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
  );
  const serviceRoleKey = requireEnv(env.SUPABASE_SERVICE_ROLE_KEY ?? null, "SUPABASE_SERVICE_ROLE_KEY");
  const baseUrl = getBukApiBaseUrl(env);
  const syncWindow = { from: options.from, to: options.to };

  const [vacationsResult, absencesResult] = await Promise.all([
    fetchBukCollection(baseUrl, authToken, "/vacations"),
    fetchBukCollection(baseUrl, authToken, "/absences"),
  ]);

  const desiredResult = buildDesiredExceptions(vacationsResult.rows, absencesResult.rows, syncWindow);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const activeBukEmployeeIds = await fetchActiveBukEmployeeIds(supabase);
  const syncableDesired = desiredResult.desired.filter((entry) => activeBukEmployeeIds.has(String(entry.bukEmployeeId)));
  const skippedInactiveOrMissingWorkers = desiredResult.desired.length - syncableDesired.length;
  const existingBukExceptions = await fetchExistingBukExceptions(supabase, syncWindow);
  const exceptionsToClear = existingBukExceptions.filter(
    (exception) => !desiredResult.desiredKeys.has(`${exception.bukEmployeeId}|${exception.exception_date}`),
  );

  if (options.dryRun) {
    console.log(JSON.stringify({
      ok: true,
      mode: "dry-run",
      window: syncWindow,
      buk: {
        vacationRecords: vacationsResult.rows.length,
        vacationPagesProcessed: vacationsResult.pagesProcessed,
        absenceRecords: absencesResult.rows.length,
        absencePagesProcessed: absencesResult.pagesProcessed,
      },
      acceptedVacationRecords: desiredResult.acceptedVacationRecords,
      acceptedMedicalLeaveRecords: desiredResult.acceptedMedicalLeaveRecords,
      skippedAbsenceRecords: desiredResult.skippedAbsenceRecords,
      desiredExceptionDays: desiredResult.desired.length,
      syncableExceptionDays: syncableDesired.length,
      skippedInactiveOrMissingWorkers,
      existingBukExceptionDays: existingBukExceptions.length,
      exceptionDaysToClear: exceptionsToClear.length,
    }, null, 2));
    return;
  }

  const applied = await runLimited(syncableDesired, (entry) => syncException(supabase, entry), "synced");
  const cleared = await runLimited(exceptionsToClear, (entry) => clearException(supabase, entry), "cleared");

  console.log(JSON.stringify({
    ok: applied.failed.length === 0 && cleared.failed.length === 0,
    mode: "apply",
    window: syncWindow,
    buk: {
      vacationRecords: vacationsResult.rows.length,
      vacationPagesProcessed: vacationsResult.pagesProcessed,
      absenceRecords: absencesResult.rows.length,
      absencePagesProcessed: absencesResult.pagesProcessed,
    },
    acceptedVacationRecords: desiredResult.acceptedVacationRecords,
    acceptedMedicalLeaveRecords: desiredResult.acceptedMedicalLeaveRecords,
    skippedAbsenceRecords: desiredResult.skippedAbsenceRecords,
    desiredExceptionDays: desiredResult.desired.length,
    syncableExceptionDays: syncableDesired.length,
    skippedInactiveOrMissingWorkers,
    existingBukExceptionDays: existingBukExceptions.length,
    exceptionDaysToClear: exceptionsToClear.length,
    applied,
    cleared,
  }, null, 2));

  if (applied.failed.length > 0 || cleared.failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
