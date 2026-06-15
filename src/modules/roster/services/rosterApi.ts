import { supabase } from "../../../shared/lib/supabase";
import type {
  RosterExceptionType,
  RosterSetupCatalogs,
  RosterWorkerSearchItem,
  ShiftPattern,
  WorkerRosterAssignment,
  WorkerRosterException,
  WorkerScheduleDay,
  WorkerSchedulePayload
} from "../types";

function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase no está configurado en este entorno.");
  }

  return supabase;
}

function asArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readRosterExceptionSource(value: unknown) {
  return value === "buk" || value === "incentive_auto" ? value : "manual";
}

function mapShiftPattern(row: Record<string, unknown>): ShiftPattern {
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    description: readNullableText(row.description),
    workingDays: Number(row.working_days ?? 0),
    restingDays: Number(row.resting_days ?? 0),
    cycleLength: Number(row.cycle_length ?? 0),
    colorHex: readNullableText(row.color_hex),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at ?? "")
  };
}

function mapSetupCatalogs(payload: unknown): RosterSetupCatalogs {
  const source = (payload ?? {}) as Record<string, unknown>;

  return {
    patterns: asArray<Record<string, unknown>>(source.patterns).map(mapShiftPattern),
    exceptionTypes: asArray<Record<string, unknown>>(source.exception_types).map((item) => ({
      value: String(item.value ?? "") as RosterExceptionType,
      label: String(item.label ?? "")
    }))
  };
}

function mapWorkerSchedule(payload: unknown): WorkerSchedulePayload {
  const source = (payload ?? {}) as Record<string, unknown>;
  const worker = (source.worker ?? {}) as Record<string, unknown>;
  const range = (source.range ?? {}) as Record<string, unknown>;
  const summary = (source.summary ?? {}) as Record<string, unknown>;

  return {
    worker: {
      bukEmployeeId: String(worker.buk_employee_id ?? ""),
      fullName: String(worker.full_name ?? ""),
      documentNumber: String(worker.document_number ?? ""),
      documentType: String(worker.document_type ?? "rut"),
      jobTitle: String(worker.job_title ?? ""),
      contractCode: readNullableText(worker.contract_code),
      areaName: readNullableText(worker.area_name)
    },
    range: {
      startDate: String(range.start_date ?? ""),
      endDate: String(range.end_date ?? "")
    },
    summary: {
      workingDays: Number(summary.working_days ?? 0),
      restingDays: Number(summary.resting_days ?? 0),
      exceptionDays: Number(summary.exception_days ?? 0),
      unassignedDays: Number(summary.unassigned_days ?? 0)
    },
    assignments: asArray<Record<string, unknown>>(source.assignments).map(
      (item): WorkerRosterAssignment => ({
        id: String(item.id ?? ""),
        patternId: String(item.pattern_id ?? ""),
        patternName: String(item.pattern_name ?? ""),
        patternCode: String(item.pattern_code ?? ""),
        workingDays: Number(item.working_days ?? 0),
        restingDays: Number(item.resting_days ?? 0),
        cycleLength: Number(item.cycle_length ?? 0),
        startDate: String(item.start_date ?? ""),
        endDate: readNullableText(item.end_date),
        notes: readNullableText(item.notes),
        contractCode: readNullableText(item.contract_code),
        areaName: readNullableText(item.area_name),
        createdAt: String(item.created_at ?? "")
      })
    ),
    exceptions: asArray<Record<string, unknown>>(source.exceptions).map(
      (item): WorkerRosterException => ({
        id: String(item.id ?? ""),
        exceptionDate: String(item.exception_date ?? ""),
        exceptionType: String(item.exception_type ?? "vacation") as RosterExceptionType,
        exceptionLabel: String(item.exception_label ?? ""),
        exceptionSource: readRosterExceptionSource(item.exception_source),
        notes: readNullableText(item.notes),
        isActive: Boolean(item.is_active),
        createdAt: String(item.created_at ?? "")
      })
    ),
    days: asArray<Record<string, unknown>>(source.days).map(
      (item): WorkerScheduleDay => ({
        date: String(item.date ?? ""),
        assignmentId: readNullableText(item.assignment_id),
        patternId: readNullableText(item.pattern_id),
        patternName: readNullableText(item.pattern_name),
        cycleDay:
          item.cycle_day === null || item.cycle_day === undefined ? null : Number(item.cycle_day),
        baseStatus: String(item.base_status ?? "unassigned") as WorkerScheduleDay["baseStatus"],
        effectiveStatus: String(item.effective_status ?? "unassigned") as WorkerScheduleDay["effectiveStatus"],
        exceptionType: readNullableText(item.exception_type) as RosterExceptionType | null,
        exceptionLabel: readNullableText(item.exception_label),
        exceptionSource:
          item.exception_source === null || item.exception_source === undefined
            ? null
            : readRosterExceptionSource(item.exception_source),
        exceptionNotes: readNullableText(item.exception_notes),
        isWorkingDay: Boolean(item.is_working_day),
        isRestDay: Boolean(item.is_rest_day)
      })
    )
  };
}

export async function fetchRosterSetupCatalogs() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_roster_setup_catalogs");

  if (error) {
    throw new Error(error.message || "No fue posible cargar la configuración de jornadas.");
  }

  return mapSetupCatalogs(data);
}

export async function searchRosterWorkers(search: string, limit = 12) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("search_hr_roster_workers", {
    p_search: search.trim() || null,
    p_limit: limit
  });

  if (error) {
    throw new Error(error.message || "No fue posible buscar trabajadores.");
  }

  return asArray<Record<string, unknown>>(data).map(
    (item): RosterWorkerSearchItem => ({
      bukEmployeeId: String(item.buk_employee_id ?? ""),
      fullName: String(item.full_name ?? ""),
      documentNumber: String(item.document_number ?? ""),
      documentType: String(item.document_type ?? "rut"),
      jobTitle: String(item.job_title ?? ""),
      contractCode: readNullableText(item.contract_code),
      areaName: readNullableText(item.area_name),
      displayLabel: String(item.display_label ?? "")
    })
  );
}

export async function fetchWorkerSchedule(params: {
  bukEmployeeId: string;
  startDate: string;
  endDate: string;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_worker_schedule", {
    p_buk_employee_id: params.bukEmployeeId,
    p_start_date: params.startDate,
    p_end_date: params.endDate
  });

  if (error) {
    throw new Error(error.message || "No fue posible cargar la pauta del trabajador.");
  }

  return mapWorkerSchedule(data);
}

export async function upsertShiftPattern(input: {
  patternId?: string | null;
  code?: string | null;
  name: string;
  workingDays: number;
  restingDays: number;
  description?: string | null;
  colorHex?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("upsert_hr_shift_pattern", {
    p_pattern_id: input.patternId ?? null,
    p_code: input.code ?? null,
    p_name: input.name,
    p_working_days: input.workingDays,
    p_resting_days: input.restingDays,
    p_description: input.description ?? null,
    p_color_hex: input.colorHex ?? null
  });

  if (error) {
    throw new Error(error.message || "No fue posible guardar la pauta.");
  }

  return String(data ?? "");
}

export async function setShiftPatternStatus(patternId: string, isActive: boolean) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("set_hr_shift_pattern_status", {
    p_pattern_id: patternId,
    p_is_active: isActive
  });

  if (error) {
    throw new Error(error.message || "No fue posible actualizar el estado de la pauta.");
  }
}

export async function assignWorkerRoster(input: {
  bukEmployeeId: string;
  patternId: string;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("assign_hr_worker_roster", {
    p_buk_employee_id: input.bukEmployeeId,
    p_pattern_id: input.patternId,
    p_start_date: input.startDate,
    p_end_date: input.endDate ?? null,
    p_notes: input.notes ?? null
  });

  if (error) {
    throw new Error(error.message || "No fue posible asignar la pauta al trabajador.");
  }

  return String(data ?? "");
}

export async function upsertRosterException(input: {
  exceptionId?: string | null;
  bukEmployeeId: string;
  exceptionDate: string;
  exceptionType: RosterExceptionType;
  notes?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("upsert_hr_roster_exception", {
    p_exception_id: input.exceptionId ?? null,
    p_buk_employee_id: input.bukEmployeeId,
    p_exception_date: input.exceptionDate,
    p_exception_type: input.exceptionType,
    p_notes: input.notes ?? null
  });

  if (error) {
    throw new Error(error.message || "No fue posible guardar la excepción.");
  }

  return String(data ?? "");
}

export async function setRosterExceptionStatus(exceptionId: string, isActive: boolean) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("set_hr_roster_exception_status", {
    p_exception_id: exceptionId,
    p_is_active: isActive
  });

  if (error) {
    throw new Error(error.message || "No fue posible actualizar la excepción.");
  }
}
