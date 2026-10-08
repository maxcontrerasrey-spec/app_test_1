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
  vehicle_id: string | null;
  plate: string | null;
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;
  year: string | null;
  driver_buk_employee_id: string | null;
  driver_is_working_day: boolean | null;
  driver_is_rest_day: boolean | null;
  driver_roster_status: string | null;
  planned_vehicle_type: string | null;
  vehicle_type_mismatch: boolean;
  planning_status: string;
  execution_status: string;
  risk_status: "green" | "attention" | "at_risk" | "critical";
};

export type AtlasVehiclePosition = {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed_kph: number | null;
  heading_degrees: number | null;
  ignition: boolean | null;
  observed_at: string;
};

export type AtlasTemplate = {
  id: number;
  contract_id: number;
  name: string;
  service_type: string;
  contractual_name: string | null;
  schedule_label: string | null;
};

export type AtlasVehicle = { id: string; code: string; plate: string | null; vehicle_type: string | null; brand: string | null; model: string | null; year: string | null; client_label?: string | null; routingProfile?: AtlasVehicleRoutingProfile | null };
export type AtlasVehicleRoutingProfile = {
  vehicle_id: string; vehicle_type: "BUS" | "MINIBUS" | "VAN" | "OTHER" | null; passenger_capacity: number | null;
  length_m: number | null; width_m: number | null; height_m: number | null; wheelbase_m: number | null;
  turning_radius_m: number | null; gross_weight_kg: number | null; allow_uturn: boolean | null;
  narrow_road_tolerance: "LOW" | "MEDIUM" | "HIGH" | null; source: string; verified_at: string | null;
};
export type AtlasContract = { id: number; code: string; contract_name: string };
export type AtlasDriver = { buk_employee_id: string; full_name: string; document_number: string | null; display_label: string; contract_code: string | null; roster_effective_status: string; is_working_day: boolean; is_rest_day: boolean };
export type AtlasServiceRoute = {
  id: string;
  service_template_id: number;
  prefix: string;
  route_code: string;
  version: number;
  is_active: boolean;
  planning_distance_meters: number | null;
  planning_duration_seconds: number | null;
  planned_vehicle_type: string | null;
  atlas_ops_service_route_stops: Array<{
    id: string;
    stop_order: number;
    label: string;
    latitude: number;
    longitude: number;
    provider_place_id: string | null;
    location_source: "tomtom" | "map_pin" | "preset";
  }>;
};

export type TomTomSuggestion = { id: string | null; type: "address" | "street" | "intersection" | null; label: string };
export type TomTomPlaceMatch = { id: string | null; type: string | null; label: string; lat: number; lng: number };
export type AtlasRouteManeuver = {
  maneuverId: string; latitude: number | null; longitude: number | null;
  maneuverType: "LEFT" | "RIGHT" | "UTURN" | "STRAIGHT" | "ROUNDABOUT" | "MERGE" | "EXIT" | "OTHER";
  instruction: string; roadNames: string[]; turnAngleDeg: number | null; inboundHeading: number | null; outboundHeading: number | null;
  roadClassFrom: null; roadClassTo: null; lanesFrom: null; lanesTo: null; oneWay: null; estimatedRoadWidthM: null;
  trafficLevel: "UNKNOWN"; knownRestrictionCount: null; geometryConfidence: number; sourceEvidence: string[];
};
export type AtlasRouteAuditDecision = "APPROVE" | "WARNING" | "REJECT" | "INSUFFICIENT_EVIDENCE" | "ERROR";
export type AtlasRouteAuditResponse = {
  decision: AtlasRouteAuditDecision; riskScore: number | null; summary: string; analyzedManeuvers: Array<Record<string, unknown>>;
  requiresReplan: boolean; requiresHumanReview: boolean; runId: string | null; mode: "OFF" | "SHADOW"; provider?: string;
  model?: string; latencyMs?: number; candidateManeuverCount?: number; auditedManeuverCount?: number; vehicleProfileVerified?: boolean;
  errorCategory?: string | null; status?: string;
};
export type AtlasPlannedRoute = { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number; provider: "valhalla"; travelMode: "bus"; plannedVehicleType?: string; referenceModel?: string; referenceDimensions?: { length: number; width: number; height: number; weight: number }; dimensionEvidence?: string; referenceDimensionsSent?: boolean; maneuvers?: AtlasRouteManeuver[]; maneuverRiskCandidates?: Array<{ maneuverId: string; score: number; reasons: string[]; requiresAiAudit: boolean }> };
export type AtlasOptimizedRoute = AtlasPlannedRoute & { order: number[]; matrixDurationSeconds: number; inputOrderMatrixDurationSeconds: number | null; optimizationMethod: "valhalla_matrix_open_path_v1"; replannedForFeasibility?: boolean; feasibilityAlternativesEvaluated?: number };

export async function getAtlasOperationsCatalogs() {
  const db = client();
  const [templates, vehicles, profiles, contracts, editors] = await Promise.all([
    db.from("atlas_ops_service_templates").select("id, contract_id, name, service_type, contractual_name, schedule_label").eq("is_active", true).order("name"),
    db.from("atlas_ops_vehicles").select("id, code, plate, vehicle_type, brand, model, year, client_label").eq("is_active", true).order("code"),
    db.from("atlas_ops_vehicle_routing_profiles").select("vehicle_id, vehicle_type, passenger_capacity, length_m, width_m, height_m, wheelbase_m, turning_radius_m, gross_weight_kg, allow_uturn, narrow_road_tolerance, source, verified_at"),
    db.from("contracts").select("id, code, contract_name").eq("is_active", true).order("contract_name"),
    db.from("atlas_ops_contract_editors").select("contract_id").eq("is_active", true)
  ]);
  for (const result of [templates, vehicles, profiles, contracts, editors]) {
    if (result.error) throw new Error(getSupabaseErrorMessage(result.error, "No fue posible cargar los catálogos operacionales.", "message"));
  }
  return {
    templates: asArray<AtlasTemplate>(templates.data),
    vehicles: asArray<AtlasVehicle>(vehicles.data).map((vehicle) => ({ ...vehicle, routingProfile: asArray<AtlasVehicleRoutingProfile>(profiles.data).find((profile) => profile.vehicle_id === vehicle.id) ?? null })),
    contracts: asArray<AtlasContract>(contracts.data),
    editableContractIds: asArray<{ contract_id: number }>(editors.data).map((row) => Number(row.contract_id))
  };
}

export async function getAtlasDispatches(from: string, to: string) {
  const result = await client().from("atlas_ops_control_tower").select("*").gte("service_date", from).lte("service_date", to).order("planned_start_at", { ascending: true });
  if (result.error) throw new Error(getSupabaseErrorMessage(result.error, "No fue posible cargar los servicios.", "message"));
  return asArray<AtlasDispatch>(result.data);
}

/** Reads the compact current-position snapshot for all vehicles assigned to visible dispatches. */
export async function getAtlasLatestVehiclePositions(vehicleIds: string[]): Promise<AtlasVehiclePosition[]> {
  const ids = [...new Set(vehicleIds.filter(Boolean))];
  if (!ids.length) return [];

  const result = await client().from("atlas_ops_vehicle_positions")
    .select("vehicle_id, latitude, longitude, speed_kph, heading_degrees, ignition, observed_at")
    .in("vehicle_id", ids)
    .order("observed_at", { ascending: false });
  if (result.error) throw new Error(getSupabaseErrorMessage(result.error, "No fue posible cargar posiciones GPS.", "message"));
  return asArray<AtlasVehiclePosition>(result.data);
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

export async function searchAtlasDrivers(search: string, date: string, signal?: AbortSignal) {
  const request = client().rpc("atlas_ops_search_drivers", {
    p_search: search.trim(), p_service_date: date, p_limit: 12
  });
  return asArray<AtlasDriver>(await unwrap<unknown>(
    signal ? request.abortSignal(signal) : request,
    "No fue posible buscar conductores."
  ));
}

export async function createAtlasDispatch(payload: Record<string, unknown>) {
  return unwrap<string>(client().rpc("atlas_ops_create_dispatch", { p_payload: payload }), "No fue posible crear el servicio.");
}

export async function transitionAtlasDispatch(id: string, transition: string) {
  await unwrap<null>(client().rpc("atlas_ops_transition_dispatch", { p_dispatch_id: id, p_transition: transition }), "No fue posible actualizar el servicio.");
}

export async function reassignAtlasDispatchResources(id: string, driverBukEmployeeId: string | null, vehicleId: string | null, reason: string) {
  await unwrap<null>(client().rpc("atlas_ops_reassign_dispatch", {
    p_dispatch_id: id,
    p_driver_buk_employee_id: driverBukEmployeeId,
    p_vehicle_id: vehicleId,
    p_reason: reason
  }), "No fue posible cambiar los recursos del servicio.");
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

export async function getAtlasServiceRoutes(serviceTemplateId: number): Promise<AtlasServiceRoute[]> {
  const result = await client().from("atlas_ops_service_routes")
    .select("id, service_template_id, prefix, route_code, version, is_active, planning_distance_meters, planning_duration_seconds, planned_vehicle_type, atlas_ops_service_route_stops(id, stop_order, label, latitude, longitude, provider_place_id, location_source)")
    .eq("service_template_id", serviceTemplateId)
    .order("created_at", { ascending: false });
  if (result.error) throw new Error(getSupabaseErrorMessage(result.error, "No fue posible cargar las rutas del servicio base."));
  return asArray<AtlasServiceRoute>(result.data);
}

export async function getAtlasServiceRoute(routeId: string): Promise<AtlasServiceRoute> {
  const result = await client().from("atlas_ops_service_routes")
    .select("id, service_template_id, prefix, route_code, version, is_active, planning_distance_meters, planning_duration_seconds, planned_vehicle_type, atlas_ops_service_route_stops(id, stop_order, label, latitude, longitude, provider_place_id, location_source)")
    .eq("id", routeId).single();
  if (result.error) throw new Error(getSupabaseErrorMessage(result.error, "No fue posible cargar la ruta asignada."));
  return result.data as AtlasServiceRoute;
}

export async function saveAtlasServiceRoute(input: {
  serviceTemplateId: number;
  prefix: string;
  stops: Array<{ label: string; lat: number; lng: number; providerPlaceId?: string | null; source: "tomtom" | "map_pin" | "preset" }>;
  distanceMeters: number;
  durationSeconds: number;
  matrixDurationSeconds: number;
  inputOrderMatrixDurationSeconds: number | null;
  plannedVehicleType: string;
}) {
  return unwrap<string>(client().rpc("atlas_ops_save_optimized_service_route", {
    p_service_template_id: input.serviceTemplateId,
    p_prefix: input.prefix,
    p_stops: input.stops,
    p_distance_meters: Math.round(input.distanceMeters),
    p_duration_seconds: Math.round(input.durationSeconds),
    p_optimization_matrix_duration_seconds: Math.round(input.matrixDurationSeconds),
    p_input_order_matrix_duration_seconds: input.inputOrderMatrixDurationSeconds === null ? null : Math.round(input.inputOrderMatrixDurationSeconds),
    p_planned_vehicle_type: input.plannedVehicleType
  }), "No fue posible guardar la ruta.");
}

export async function searchAtlasTomTom(query: string, sessionId: string, signal?: AbortSignal): Promise<TomTomSuggestion[]> {
  const db = client();
  const { data: sessionData } = await db.auth.getSession();
  const session = sessionData.session;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!session?.access_token || !supabaseUrl || !anonKey) throw new Error("Inicia sesión como superadministrador para buscar direcciones.");
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/atlas-tomtom-planning`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: "suggest", query, sessionId }),
    signal
  });
  const payload = await response.json() as { suggestions?: TomTomSuggestion[]; error?: string };
  if (!response.ok) throw new Error(payload.error === "tomtom_not_configured" ? "La búsqueda TomTom aún no está configurada en producción." : `No fue posible buscar la dirección (${payload.error ?? response.status}).`);
  return payload.suggestions ?? [];
}

export async function resolveAtlasTomTomSuggestion(suggestion: TomTomSuggestion, sessionId: string, signal?: AbortSignal): Promise<TomTomPlaceMatch> {
  const db = client();
  const { data: sessionData } = await db.auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const accessToken = sessionData.session?.access_token;
  if (!accessToken || !supabaseUrl || !anonKey || !suggestion.id || !suggestion.type) throw new Error("Selecciona una sugerencia válida de TomTom.");
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/atlas-tomtom-planning`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "details", id: suggestion.id, type: suggestion.type, sessionId }),
    signal
  });
  const payload = await response.json() as { suggestion?: TomTomPlaceMatch; error?: string };
  if (!response.ok || !payload.suggestion) throw new Error(`No fue posible obtener la ubicación exacta (${payload.error ?? response.status}).`);
  return payload.suggestion;
}

export async function calculateAtlasValhallaRoute(stops: Array<{ lat: number; lng: number }>, plannedVehicleType: string, signal?: AbortSignal): Promise<AtlasPlannedRoute> {
  return callAtlasValhalla({ action: "route", stops, plannedVehicleType }, signal);
}

export async function optimizeAtlasOpenRoute(stops: Array<{ lat: number; lng: number }>, plannedVehicleType: string, fixedDestinationIndex?: number, signal?: AbortSignal): Promise<AtlasOptimizedRoute> {
  return callAtlasValhalla({ action: "optimize", stops, plannedVehicleType, ...(fixedDestinationIndex === undefined ? {} : { fixedDestinationIndex }) }, signal);
}

export async function auditAtlasRouteIntelligence(route: AtlasOptimizedRoute, serviceTemplateId: number | null, vehicleId: string | null, plannedVehicleType: string, signal?: AbortSignal): Promise<AtlasRouteAuditResponse> {
  const db = client();
  const { data: sessionData } = await db.auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const accessToken = sessionData.session?.access_token;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!accessToken || !supabaseUrl || !anonKey) throw new Error("Inicia sesión como superadministrador para auditar la ruta.");
  if (!route.maneuvers?.length) throw new Error("Valhalla no entregó maniobras para auditar esta ruta.");
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/atlas-route-intelligence`, {
    method: "POST", headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ serviceTemplateId, vehicleId, plannedVehicleType, maneuvers: route.maneuvers }), signal
  });
  const payload = await response.json() as AtlasRouteAuditResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error === "audit_persistence_failed" ? "La auditoría no quedó guardada; la propuesta de ruta sigue disponible." : `No se pudo auditar la ruta (${payload.error ?? response.status}).`);
  return payload;
}

export async function recordAtlasRouteIntelligenceFeedback(runId: string, feedbackType: string, reason: string) {
  await unwrap<string>(client().rpc("atlas_ops_record_route_intelligence_feedback", { p_run_id: runId, p_feedback_type: feedbackType, p_reason: reason }), "No fue posible guardar el feedback de la auditoría.");
}

async function callAtlasValhalla<T extends AtlasPlannedRoute>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const db = client();
  const { data: sessionData } = await db.auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const accessToken = sessionData.session?.access_token;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!accessToken || !supabaseUrl || !anonKey) throw new Error("Inicia sesión como superadministrador para calcular rutas.");
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/atlas-tomtom-planning`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
    signal
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) {
    const friendlyErrors: Record<string, string> = {
      valhalla_matrix_http_429: "El planificador de rutas está temporalmente ocupado. Espera unos segundos y vuelve a intentar.",
      valhalla_matrix_invalid_response: "Valhalla devolvió una matriz incompleta. Intenta nuevamente.",
      valhalla_route_not_returned: "Valhalla no encontró un recorrido transitable entre todas las direcciones. Revisa sus ubicaciones.",
      valhalla_route_uturn_detected: "La ruta vial contiene una maniobra de retorno que Valhalla no puede evitar con los puntos actuales.",
      valhalla_route_no_feasible_order: "Probé automáticamente otros órdenes para evitar el giro en U, pero Valhalla no encontró un recorrido transitable. Revisa el punto de acceso de las direcciones; no necesitas cambiar su orden manualmente."
    };
    throw new Error(friendlyErrors[payload.error ?? ""] ?? `No fue posible calcular la ruta (${payload.error ?? response.status}).`);
  }
  return payload as T;
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
