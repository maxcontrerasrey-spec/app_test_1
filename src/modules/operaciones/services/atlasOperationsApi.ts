import { asArray, getSupabaseClientOrThrow, getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";

function client() {
  return getSupabaseClientOrThrow("Atlas Operations no está disponible.");
}

async function unwrap<T>(request: PromiseLike<{ data: unknown; error: unknown }>, fallback: string): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(getSupabaseErrorMessage(error, fallback, "message"));
  return data as T;
}

export type AtlasDispatch = {
  id: string;
  contract_id: number;
  contract_code: string;
  service_date: string;
  shift: string;
  planned_start_at: string | null;
  acknowledged_at: string | null;
  service_name: string | null;
  driver_name_snapshot: string | null;
  vehicle_code: string | null;
  plate: string | null;
  planning_status: string;
  execution_status: string;
  risk_status: "green" | "attention" | "at_risk" | "critical";
};

export type AtlasTemplate = {
  id: number;
  contract_id: number;
  name: string;
  service_type: string;
  contractual_name: string | null;
  schedule_label: string | null;
};

export type AtlasVehicle = { id: string; code: string; plate: string | null; vehicle_type: string | null };
export type AtlasContract = { id: number; code: string; contract_name: string };
export type AtlasDriver = { buk_employee_id: string; full_name: string; document_number: string | null; display_label: string; contract_code: string | null; is_working_day: boolean; is_rest_day: boolean };

export async function getAtlasOperationsCatalogs() {
  const db = client();
  const [templates, vehicles, contracts, editors] = await Promise.all([
    db.from("atlas_ops_service_templates").select("id, contract_id, name, service_type, contractual_name, schedule_label").eq("is_active", true).order("name"),
    db.from("atlas_ops_vehicles").select("id, code, plate, vehicle_type").eq("is_active", true).order("code"),
    db.from("contracts").select("id, code, contract_name").eq("is_active", true).order("contract_name"),
    db.from("atlas_ops_contract_editors").select("contract_id").eq("is_active", true)
  ]);
  for (const result of [templates, vehicles, contracts, editors]) {
    if (result.error) throw new Error(getSupabaseErrorMessage(result.error, "No fue posible cargar los catálogos operacionales.", "message"));
  }
  return {
    templates: asArray<AtlasTemplate>(templates.data),
    vehicles: asArray<AtlasVehicle>(vehicles.data),
    contracts: asArray<AtlasContract>(contracts.data),
    editableContractIds: asArray<{ contract_id: number }>(editors.data).map((row) => Number(row.contract_id))
  };
}

export async function getAtlasDispatches(from: string, to: string) {
  const result = await client().from("atlas_ops_control_tower").select("*").gte("service_date", from).lte("service_date", to).order("planned_start_at", { ascending: true });
  if (result.error) throw new Error(getSupabaseErrorMessage(result.error, "No fue posible cargar los servicios.", "message"));
  return asArray<AtlasDispatch>(result.data);
}

export async function getAtlasAlerts(dispatchIds: string[]) {
  if (!dispatchIds.length) return [];
  const result = await client().from("atlas_ops_alerts")
    .select("id, dispatch_id, alert_type, status, message, opened_at, acknowledged_at")
    .in("dispatch_id", dispatchIds)
    .in("status", ["open", "acknowledged"])
    .order("opened_at", { ascending: false });
  if (result.error) throw new Error(getSupabaseErrorMessage(result.error, "No fue posible cargar las excepciones.", "message"));
  return asArray<Record<string, unknown>>(result.data);
}

export async function refreshAtlasSlaAlerts() {
  return unwrap<number>(client().rpc("atlas_ops_refresh_sla_alerts", { p_at: new Date().toISOString() }), "No fue posible evaluar hitos SLA.");
}

export async function acknowledgeAtlasAlert(id: string) {
  await unwrap<null>(client().rpc("atlas_ops_acknowledge_alert", { p_alert_id: id }), "No fue posible atender la alerta.");
}

export async function searchAtlasDrivers(search: string, date: string) {
  return asArray<AtlasDriver>(await unwrap<unknown>(client().rpc("atlas_ops_search_drivers", {
    p_search: search.trim(), p_service_date: date, p_limit: 12
  }), "No fue posible buscar conductores."));
}

export async function createAtlasDispatch(payload: Record<string, unknown>) {
  return unwrap<string>(client().rpc("atlas_ops_create_dispatch", { p_payload: payload }), "No fue posible crear el servicio.");
}

export async function transitionAtlasDispatch(id: string, transition: string) {
  await unwrap<null>(client().rpc("atlas_ops_transition_dispatch", { p_dispatch_id: id, p_transition: transition }), "No fue posible actualizar el servicio.");
}

export async function getAtlasDispatchEvents(dispatchId: string) {
  const result = await client().from("atlas_ops_dispatch_events").select("id, dispatch_id, event_type, source, occurred_at, actor_user_id, payload").eq("dispatch_id", dispatchId).order("occurred_at", { ascending: true });
  if (result.error) throw new Error(getSupabaseErrorMessage(result.error, "No fue posible cargar el historial.", "message"));
  return asArray<Record<string, unknown>>(result.data);
}

export async function getAtlasDriverDispatches() {
  return asArray<Record<string, unknown>>(await unwrap<unknown>(client().rpc("atlas_ops_driver_get_dispatches"), "No fue posible cargar tus servicios."));
}

export async function driverAcknowledgeDispatch(id: string) {
  await unwrap<null>(client().rpc("atlas_ops_driver_acknowledge", { p_dispatch_id: id }), "No fue posible confirmar el servicio.");
}

export async function driverReportIncident(id: string, category: string, severity: string, description: string) {
  await unwrap<string>(client().rpc("atlas_ops_driver_report_incident", { p_dispatch_id: id, p_category: category, p_severity: severity, p_description: description }), "No fue posible registrar la incidencia.");
}

export async function saveAtlasServiceTemplate(payload: Record<string, unknown>) {
  await unwrap<number>(client().rpc("atlas_ops_save_service_template", { p_payload: payload }), "No fue posible guardar el servicio base.");
}

export async function saveAtlasMilestoneTemplate(payload: Record<string, unknown>) {
  await unwrap<string>(client().rpc("atlas_ops_save_milestone_template", { p_payload: payload }), "No fue posible guardar el hito.");
}

export async function saveAtlasVehicle(payload: Record<string, unknown>) {
  await unwrap<string>(client().rpc("atlas_ops_save_vehicle", { p_payload: payload }), "No fue posible guardar el vehículo.");
}

export async function setAtlasContractEditor(userId: string, contractId: number, active: boolean) {
  await unwrap<null>(client().rpc("atlas_ops_set_contract_editor", { p_account_user_id: userId, p_contract_id: contractId, p_is_active: active }), "No fue posible actualizar el acceso al contrato.");
}

export async function bindAtlasDriverAccount(userId: string, bukEmployeeId: string) {
  await unwrap<null>(client().rpc("atlas_ops_bind_driver_account", { p_account_user_id: userId, p_buk_employee_id: bukEmployeeId }), "No fue posible vincular la identidad del conductor.");
}

export async function getAtlasAdminUsers() {
  const result = await client().from("profiles").select("id, email, full_name").eq("status", "active").order("full_name");
  if (result.error) throw new Error(getSupabaseErrorMessage(result.error, "No fue posible cargar usuarios activos.", "message"));
  return asArray<{ id: string; email: string; full_name: string }>(result.data);
}

export async function resolveAtlasAlert(id: string, note: string) {
  await unwrap<null>(client().rpc("atlas_ops_resolve_alert", { p_alert_id: id, p_note: note }), "No fue posible resolver la alerta.");
}
