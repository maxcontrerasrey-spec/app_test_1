// @ts-nocheck
import { supabase } from "../../../shared/lib/supabase";
import { validateServiceEntryPayload } from "../lib/service-entry";

export async function submitServiceEntry(payload: any, userId: string) {
  const validation = validateServiceEntryPayload(payload);

  if (!validation.isValid) {
    return { ok: false, error: "Hay campos inválidos en la planificación.", fieldErrors: validation.errors };
  }

  const { cleaned } = validation;

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, code")
    .eq("code", cleaned.contractCode)
    .maybeSingle();

  if (contractError || !contract) {
    return { ok: false, error: "Contrato no encontrado." };
  }

  const { data: hasAccess, error: accessError } = await supabase
    .from("user_contracts")
    .select("contract_id")
    .eq("user_id", userId)
    .eq("contract_id", contract.id)
    .maybeSingle();

  if (accessError || !hasAccess) {
    return { ok: false, error: "No tienes acceso a este contrato." };
  }

  const { data: service, error: serviceError } = await supabase
    .from("base_services")
    .select("id, contract_id, is_active, operational_name, company_name, contractual_name, contractual_category")
    .eq("external_key", cleaned.serviceExternalKey)
    .eq("contract_id", contract.id)
    .maybeSingle();

  if (serviceError || !service || service.is_active === false) {
    return { ok: false, error: "Servicio no disponible para el contrato seleccionado." };
  }

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipment")
    .select("equipment_code, plate, equipment_type, current_client, is_active")
    .eq("equipment_code", cleaned.equipmentCode)
    .maybeSingle();

  if (equipmentError || !equipment || equipment.is_active === false) {
    return {
      ok: false,
      error: "Equipo no disponible.",
      fieldErrors: { equipmentCode: "Selecciona un equipo válido." },
    };
  }

  const entryRecord = {
    service_date: cleaned.serviceDate,
    shift: cleaned.shift,
    base_service_id: service.id,
    contract_id: contract.id,
    contract_code: contract.code,
    service_operational_name: service.operational_name,
    service_contractual_name: service.contractual_name,
    service_category: service.contractual_category,
    service_company: service.company_name,
    driver_name: cleaned.driverName,
    driver_document: cleaned.driverDocument || null,
    driver_area: cleaned.driverArea || null,
    driver_shift_status: cleaned.driverShiftStatus,
    equipment_code: cleaned.equipmentCode,
    equipment_plate: equipment.plate || null,
    equipment_type: equipment.equipment_type || null,
    equipment_client: equipment.current_client || null,
    created_by: userId,
  };

  const { data: existingEntries, error: existingEntriesError } = await supabase
    .from("service_entries")
    .select("id")
    .eq("service_date", cleaned.serviceDate)
    .eq("shift", cleaned.shift)
    .eq("contract_id", contract.id)
    .eq("base_service_id", service.id)
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingEntriesError) {
    return { ok: false, error: "No fue posible verificar la planificación existente." };
  }

  const existingEntry = existingEntries?.[0] ?? null;
  const persistenceQuery = existingEntry
    ? supabase.from("service_entries").update(entryRecord).eq("id", existingEntry.id)
    : supabase.from("service_entries").insert(entryRecord);
    
  const { error: persistenceError } = await persistenceQuery;

  if (persistenceError) {
    return { ok: false, error: "No fue posible guardar la planificación." };
  }

  return {
    ok: true,
    mode: existingEntry ? "updated" : "inserted",
    message: existingEntry ? "Planificación actualizada correctamente." : "Planificación guardada correctamente.",
  };
}
