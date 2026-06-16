import { supabase } from "../../../shared/lib/supabase";
import { validateServiceEntryPayload, type ServiceEntryPayload } from "../lib/service-entry";

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

  if (!supabase) {
    return { ok: false, error: "Supabase no está configurado." };
  }

  if (cleanedEntries.length === 0) {
    return {
      ok: false,
      error: "No hay servicios válidos para guardar.",
    };
  }

  const { data, error } = await supabase.rpc("submit_service_entries_batch", {
    p_entries: cleanedEntries,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "No fue posible guardar la planificación.",
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
