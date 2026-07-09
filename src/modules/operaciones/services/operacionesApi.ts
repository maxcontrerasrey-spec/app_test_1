import { supabase } from "../../../shared/lib/supabase";
import {
  asArray,
  getSupabaseErrorMessage,
  getSupabaseClientOrThrow,
  readNullableText
} from "../../../shared/lib/supabaseRpc";
import { validateServiceEntryPayload, type ServiceEntryPayload } from "../lib/service-entry";
import type { Driver } from "../types";

export interface SubmitServiceEntryResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  mode?: "inserted" | "updated";
  message?: string;
}

export interface SubmitServiceEntryBatchItem {
  serviceId: number;
  payload: ServiceEntryPayload;
}

export interface SubmitServiceEntryBatchResult {
  ok: boolean;
  error?: string;
  fieldErrorsByService?: Record<number, Record<string, string>>;
  savedCount?: number;
}

type BackendBatchError = {
  index?: number;
  service_id?: string | number | null;
  field_errors?: Record<string, string>;
};

export async function searchOperationsDrivers(search: string, serviceDate: string, limit = 12) {
  const client = getSupabaseClientOrThrow("Supabase no está configurado.");

  const { data, error } = await client.rpc("search_operations_drivers", {
    p_search: search.trim() || null,
    p_service_date: serviceDate || null,
    p_limit: limit,
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible buscar conductores.", "message")
    );
  }

  return asArray<Record<string, unknown>>(data).map(
    (item): Driver => ({
      id: String(item.buk_employee_id ?? ""),
      fullName: String(item.full_name ?? ""),
      documentNumber: String(item.document_number ?? ""),
      documentType: readNullableText(item.document_type) ?? "rut",
      areaName: readNullableText(item.area_name) ?? "",
      areaCode: readNullableText(item.contract_code) ?? "",
      jobTitle: readNullableText(item.job_title) ?? "",
      contractCode: readNullableText(item.contract_code),
      displayLabel: readNullableText(item.display_label) ?? "",
      rosterBaseStatus: readNullableText(item.roster_base_status),
      rosterEffectiveStatus: readNullableText(item.roster_effective_status),
      isWorkingDay: Boolean(item.is_working_day),
      isRestDay: Boolean(item.is_rest_day),
      isActive: true,
    })
  );
}

export async function submitServiceEntry(
  payload: ServiceEntryPayload,
  userId: string
): Promise<SubmitServiceEntryResult> {
  const response = await submitServiceEntriesBatch([{ serviceId: 0, payload }], userId);

  if (response.ok) {
    return {
      ok: true,
      mode: "updated",
      message: "Planificación guardada correctamente.",
    };
  }

  return {
    ok: false,
    error: response.error,
    fieldErrors: response.fieldErrorsByService?.[0],
  };
}

export async function submitServiceEntriesBatch(
  entries: SubmitServiceEntryBatchItem[],
  _userId?: string
): Promise<SubmitServiceEntryBatchResult> {
  const fieldErrorsByService: Record<number, Record<string, string>> = {};
  const cleanedEntries = [];

  for (const entry of entries) {
    const validation = validateServiceEntryPayload(entry.payload);

    if (!validation.isValid || !validation.cleaned) {
      fieldErrorsByService[entry.serviceId] = validation.errors;
      continue;
    }

    cleanedEntries.push({
      serviceId: entry.serviceId,
      ...validation.cleaned,
    });
  }

  if (Object.keys(fieldErrorsByService).length > 0) {
    return {
      ok: false,
      error: "Hay campos inválidos en la planificación.",
      fieldErrorsByService,
    };
  }

  const client = supabase;
  if (!client) {
    return { ok: false, error: "Supabase no está configurado." };
  }

  if (cleanedEntries.length === 0) {
    return {
      ok: false,
      error: "No hay servicios válidos para guardar.",
    };
  }

  const { data, error } = await client.rpc("submit_service_entries_batch", {
    p_entries: cleanedEntries,
  });

  if (error) {
    return {
      ok: false,
      error: getSupabaseErrorMessage(error, "No fue posible guardar la planificación.", "message"),
    };
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    errors?: BackendBatchError[];
    saved_count?: number;
  };

  if (!result.ok) {
    const backendErrors = Array.isArray(result.errors) ? result.errors : [];

    for (const backendError of backendErrors) {
      const serviceId = Number(backendError.service_id ?? -1);
      const fallbackIndex = typeof backendError.index === "number" ? backendError.index : -1;
      const originalServiceId = Number.isFinite(serviceId)
        ? serviceId
        : entries[fallbackIndex]?.serviceId;

      if (typeof originalServiceId === "number") {
        fieldErrorsByService[originalServiceId] =
          backendError.field_errors ?? { serviceExternalKey: "No fue posible guardar este servicio." };
      }
    }

    return {
      ok: false,
      error: "No fue posible guardar uno o más servicios.",
      fieldErrorsByService,
    };
  }

  return {
    ok: true,
    savedCount: result.saved_count ?? cleanedEntries.length,
  };
}
