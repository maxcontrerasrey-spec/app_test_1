import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/context/AuthContext";
import { MultiSelectField, PageShell, StandardWorkerLookupField } from "../../../shared/ui";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  createWorkerSearchQueryOptions,
  WORKER_SEARCH_DEBOUNCE_MS,
  normalizeRutAwareWorkerSearchTerm
} from "../../../shared/lib/workerSearch";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import { supabase } from "../../../shared/lib/supabase";
import { purgeLegacyOperationsDrafts } from "../lib/legacyCleanup";
import { estimateLocalRouteEnd, getRouteEndpoints } from "../lib/routeSchedule";
import { OperationsLiveMap } from "../components/OperationsLiveMap";
import {
  createAtlasDispatch,
  driverAcknowledgeDispatch,
  bindAtlasDriverAccount,
  driverReportIncident,
  getAtlasDispatchEvents,
  getAtlasDispatches,
  getAtlasLatestVehiclePositions,
  getAtlasDriverDispatches,
  getAtlasOperationsCatalogs,
  getAtlasServiceRoutes,
  getAtlasAdminUsers,
  getAtlasAlerts,
  acknowledgeAtlasAlert,
  saveAtlasMilestoneTemplate,
  saveAtlasServiceTemplate,
  saveAtlasVehicle,
  refreshAtlasSlaAlerts,
  resolveAtlasAlert,
  searchAtlasDrivers,
  setAtlasContractEditor,
  transitionAtlasDispatch,
  type AtlasDispatch,
  type AtlasDriver,
  type AtlasVehiclePosition
} from "../services/atlasOperationsApi";
import "../styles/atlas-operations.css";

const OperationsRoutePlannerDemo = lazy(() => import("./OperationsRoutePlannerDemo").then(({ OperationsRoutePlannerDemo: Page }) => ({ default: Page })));

type View = "control-tower" | "planificacion" | "despacho" | "excepciones" | "conductor" | "historial" | "configuracion";
type PlanningDriver = {
  bukEmployeeId: string;
  fullName: string;
  documentNumber: string;
  jobTitle: string;
  contractCode: string | null;
  isWorkingDay: boolean;
  isRestDay: boolean;
};

function useAtlasDriverSearch(search: string, enabled: boolean, serviceDate = localDate()) {
  return useQuery(createWorkerSearchQueryOptions({
    search,
    enabled,
    normalizeSearch: normalizeRutAwareWorkerSearchTerm,
    queryKey: (normalizedSearch) =>
      queryKeys.operations.driverSearch({ search: normalizedSearch, day: serviceDate }),
    query: (normalizedSearch, signal) => searchAtlasDrivers(normalizedSearch, serviceDate, signal),
    staleTime: 15_000
  }));
}

function useAtlasPlanningDriverSearch(search: string, enabled: boolean, serviceDate = localDate()) {
  const query = useAtlasDriverSearch(search, enabled, serviceDate);

  return {
    data: query.data?.map(mapPlanningDriver),
    error: query.error,
    isLoading: query.isLoading || query.isFetching
  };
}

function mapPlanningDriver(driver: AtlasDriver): PlanningDriver {
  return {
    bukEmployeeId: driver.buk_employee_id,
    fullName: driver.full_name,
    documentNumber: driver.document_number ?? "",
    jobTitle: "Conductor",
    contractCode: driver.contract_code,
    isWorkingDay: driver.is_working_day,
    isRestDay: driver.is_rest_day
  };
}

function PlanningDriverLookup({ serviceDate, disabled }: { serviceDate: string; disabled: boolean }) {
  const [selectedDriver, setSelectedDriver] = useState<PlanningDriver | null>(null);

  return (
    <div className="atlas-ops__field--wide">
      <StandardWorkerLookupField<PlanningDriver, string>
        id="atlas-planning-driver"
        label="Conductor BUK"
        placeholder="Buscar por nombre o RUT"
        selectedWorker={selectedDriver}
        onSelect={setSelectedDriver}
        useSearchQuery={useAtlasPlanningDriverSearch}
        searchContext={serviceDate}
        loadingMessage="Buscando conductores BUK…"
        emptyMessage="No hay conductores BUK activos que coincidan con esta búsqueda."
        disabled={disabled}
        required
        minSearchLength={2}
      />
      <input type="hidden" name="driver_buk_employee_id" value={selectedDriver?.bukEmployeeId ?? ""} />
      {selectedDriver ? <small className="atlas-ops__driver-status">{selectedDriver.isWorkingDay && !selectedDriver.isRestDay ? "En jornada" : "Jornada no validada"}</small> : null}
    </div>
  );
}

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "control-tower", label: "Control Tower" },
  { id: "planificacion", label: "Planificación" },
  { id: "despacho", label: "Despacho" },
  { id: "excepciones", label: "Excepciones" },
  { id: "conductor", label: "Conductor" },
  { id: "historial", label: "Historial" },
  { id: "configuracion", label: "Configuración" }
];

const VIEW_DESCRIPTIONS: Record<View, string> = {
  "control-tower": "Visibilidad diaria de servicios, hitos y excepciones operacionales.",
  planificacion: "Prepara servicios con contrato, jornada y recursos validados.",
  despacho: "Revisa servicios listos y controla su publicación.",
  excepciones: "Prioriza alertas abiertas y revisa su trazabilidad.",
  conductor: "Consulta servicios publicados y gestiona su recepción.",
  historial: "Revisa servicios y eventos asociados a la fecha seleccionada.",
  configuracion: "Administra catálogos y vínculos de Atlas Operations."
};

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readableStatus(value: string) {
  return value.replace(/_/g, " ");
}

export function OperationsControlTowerPage() {
  const { view } = useParams();
  if (view === "planificador-rutas") return <Suspense fallback={<p>Cargando planificador de rutas…</p>}><OperationsRoutePlannerDemo /></Suspense>;
  return <OperationsControlTowerApp />;
}

function OperationsControlTowerApp() {
  useEffect(() => { purgeLegacyOperationsDrafts(); }, []);
  const { view: routeView } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const isAdmin = auth.isSuperAdmin;
  const view = (VIEWS.some((item) => item.id === routeView) ? routeView : "control-tower") as View;
  const [day, setDay] = useState(localDate());
  const [filterContract, setFilterContract] = useState("");
  const [selectedDispatch, setSelectedDispatch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const debouncedDriverSearch = useDebouncedValue(
    driverSearch.trim(),
    WORKER_SEARCH_DEBOUNCE_MS,
    ""
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [incidentFor, setIncidentFor] = useState("");
  const [presentation, setPresentation] = useState<"map" | "list">("map");
  const [serviceSearch, setServiceSearch] = useState("");
  const [dispatchServiceTemplateId, setDispatchServiceTemplateId] = useState("");
  const [dispatchRouteId, setDispatchRouteId] = useState("");
  const [plannedStartLocal, setPlannedStartLocal] = useState("");
  const [plannedEndLocal, setPlannedEndLocal] = useState("");

  const catalogsQuery = useQuery({ queryKey: queryKeys.operations.catalogs(), queryFn: getAtlasOperationsCatalogs, staleTime: 30_000 });
  const canOperate = isAdmin || (catalogsQuery.data?.editableContractIds.length ?? 0) > 0;
  const dispatchRoutesQuery = useQuery({ queryKey: queryKeys.operations.serviceRoutes(dispatchServiceTemplateId), queryFn: () => getAtlasServiceRoutes(Number(dispatchServiceTemplateId)), enabled: view === "planificacion" && Boolean(dispatchServiceTemplateId), staleTime: 30_000 });
  const selectedDispatchRoute = dispatchRoutesQuery.data?.find((route) => route.id === dispatchRouteId && route.is_active);
  const dispatchRouteEndpoints = getRouteEndpoints(selectedDispatchRoute?.atlas_ops_service_route_stops);
  useEffect(() => {
    setPlannedEndLocal(estimateLocalRouteEnd(plannedStartLocal, selectedDispatchRoute?.planning_duration_seconds));
  }, [plannedStartLocal, selectedDispatchRoute?.id, selectedDispatchRoute?.planning_duration_seconds]);
  const dispatchQuery = useQuery({ queryKey: queryKeys.operations.dispatches(day), queryFn: () => getAtlasDispatches(day, day), staleTime: 10_000 });
  const activeVehicleIds = useMemo(() => [...new Set((dispatchQuery.data ?? []).map((row) => row.vehicle_id).filter((id): id is string => Boolean(id)))].sort(), [dispatchQuery.data]);
  const positionsQuery = useQuery({
    queryKey: queryKeys.operations.vehiclePositions(activeVehicleIds),
    queryFn: () => getAtlasLatestVehiclePositions(activeVehicleIds),
    enabled: view === "control-tower" && presentation === "map" && activeVehicleIds.length > 0,
    staleTime: 10_000,
    refetchInterval: 60_000
  });
  useEffect(() => {
    const realtimeClient = supabase;
    if (!realtimeClient || !isAdmin || view !== "control-tower" || presentation !== "map" || activeVehicleIds.length === 0) return;
    const positionsKey = queryKeys.operations.vehiclePositions(activeVehicleIds);
    const visibleVehicles = new Set(activeVehicleIds);
    const channel = realtimeClient
      .channel("atlas-ops:positions", { config: { private: true } })
      .on("broadcast", { event: "positions.updated" }, ({ payload }) => {
        const updates = payload && typeof payload === "object" ? (payload as { positions?: unknown }).positions : null;
        if (!Array.isArray(updates)) return;
        const incoming = updates.filter((item): item is AtlasVehiclePosition => {
          if (!item || typeof item !== "object") return false;
          const position = item as Partial<AtlasVehiclePosition>;
          return typeof position.vehicle_id === "string" && visibleVehicles.has(position.vehicle_id)
            && typeof position.latitude === "number" && typeof position.longitude === "number"
            && typeof position.observed_at === "string";
        });
        if (!incoming.length) return;
        queryClient.setQueryData<AtlasVehiclePosition[]>(positionsKey, (current = []) => {
          const latest = new Map(current.map((position) => [position.vehicle_id, position]));
          incoming.forEach((position) => {
            const previous = latest.get(position.vehicle_id);
            if (!previous || position.observed_at >= previous.observed_at) latest.set(position.vehicle_id, position);
          });
          return [...latest.values()];
        });
      })
      .subscribe();
    return () => { void realtimeClient.removeChannel(channel); };
  }, [activeVehicleIds, isAdmin, presentation, queryClient, view]);
  const alertDispatchIds = (dispatchQuery.data ?? []).map((row) => row.id);
  const alertQuery = useQuery({ queryKey: queryKeys.operations.alerts(day, alertDispatchIds), queryFn: () => getAtlasAlerts(alertDispatchIds), enabled: (view === "excepciones" || view === "control-tower") && dispatchQuery.isSuccess, staleTime: 10_000 });
  const driverQuery = useAtlasDriverSearch(
    debouncedDriverSearch,
    view === "configuracion" && canOperate,
    day
  );
  const driverDispatchQuery = useQuery({ queryKey: queryKeys.operations.driverDispatches(), queryFn: getAtlasDriverDispatches, enabled: view === "conductor", retry: false });
  const eventsQuery = useQuery({ queryKey: queryKeys.operations.events(selectedDispatch), queryFn: () => getAtlasDispatchEvents(selectedDispatch), enabled: Boolean(selectedDispatch) });
  const adminUsersQuery = useQuery({ queryKey: queryKeys.operations.adminUsers(), queryFn: getAtlasAdminUsers, enabled: view === "configuracion" && isAdmin });

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.operations.all() });
  useRealtimeQueryInvalidation({
    channelName: "atlas-operations-live",
    subscriptions: [
      { table: "atlas_ops_dispatches" },
      { table: "atlas_ops_dispatch_events" },
      { table: "atlas_ops_alerts" }
    ],
    queryKeys: [queryKeys.operations.all()],
    enabled: Boolean(auth.user?.id)
  });

  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () => { setError(""); setNotice("Cambios guardados."); void refresh(); },
    onError: (reason) => { setNotice(""); setError(reason instanceof Error ? reason.message : "No fue posible completar la acción."); }
  });

  const catalogs = catalogsQuery.data;
  const editableContracts = useMemo(() => {
    const all = catalogs?.contracts ?? [];
    if (isAdmin) return all;
    const ids = new Set(catalogs?.editableContractIds ?? []);
    return all.filter((contract) => ids.has(contract.id));
  }, [catalogs, isAdmin]);

  const filtered = (dispatchQuery.data ?? []).filter((row) => {
    const matchesContract = !filterContract || String(row.contract_id) === filterContract;
    const term = serviceSearch.trim().toLocaleLowerCase("es-CL");
    const matchesSearch = !term || [row.service_name, row.contract_code, row.driver_name_snapshot, row.vehicle_code, row.plate]
      .some((value) => value?.toLocaleLowerCase("es-CL").includes(term));
    return matchesContract && matchesSearch;
  });
  const ordered = [...filtered].sort((a, b) => {
    const priority = { critical: 0, at_risk: 1, attention: 2, green: 3 };
    return priority[a.risk_status] - priority[b.risk_status] || (a.planned_start_at ?? "").localeCompare(b.planned_start_at ?? "");
  });
  const counts = {
    critical: filtered.filter((row) => row.risk_status === "critical").length,
    risk: filtered.filter((row) => row.risk_status === "at_risk").length,
    attention: filtered.filter((row) => row.risk_status === "attention").length,
    green: filtered.filter((row) => row.risk_status === "green").length
  };

  const currentTitle = VIEWS.find((item) => item.id === view)?.label ?? "Control Tower";
  const selectedDispatchRecord = (dispatchQuery.data ?? []).find((item) => item.id === selectedDispatch);
  const usesServiceDate = view !== "configuracion" && view !== "conductor";

  async function submitDispatch(form: FormData) {
    const contractId = Number(form.get("contract_id"));
    const localStart = String(form.get("planned_start_at") ?? "");
    const localEnd = String(form.get("planned_end_at") ?? "");
    const start = new Date(localStart);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    await mutation.mutateAsync(() => createAtlasDispatch({
      contract_id: contractId,
      service_template_id: Number(form.get("service_template_id")) || null,
      route_id: String(form.get("route_id") ?? "") || null,
      planned_start_at: start.toISOString(),
      planned_end_at: localEnd ? new Date(localEnd).toISOString() : null,
      service_date: date,
      shift: form.get("shift"),
      driver_buk_employee_id: form.get("driver_buk_employee_id"),
      vehicle_id: form.get("vehicle_id"),
      origin_label: form.get("origin_label"),
      destination_label: form.get("destination_label"),
      instructions: form.get("instructions")
    }));
  }

  async function saveTemplate(form: FormData, operatingDays: string[], shifts: string[]) {
    const payload: Record<string, unknown> = Object.fromEntries(form.entries());
    payload.operating_days = operatingDays.map(Number);
    payload.schedule_label = shifts.join(", ");
    await mutation.mutateAsync(() => saveAtlasServiceTemplate(payload));
  }

  async function saveMilestone(form: FormData) {
    await mutation.mutateAsync(() => saveAtlasMilestoneTemplate(Object.fromEntries(form.entries())));
  }

  async function saveVehicle(form: FormData) {
    await mutation.mutateAsync(() => saveAtlasVehicle(Object.fromEntries(form.entries())));
  }

  async function saveEditor(form: FormData) {
    await mutation.mutateAsync(() => setAtlasContractEditor(String(form.get("user_id")), Number(form.get("contract_id")), true));
  }

  async function bindDriver(form: FormData) {
    await mutation.mutateAsync(() => bindAtlasDriverAccount(String(form.get("user_id")), String(form.get("buk_employee_id"))));
  }

  return (
    <PageShell className="atlas-ops">
      <header className="atlas-ops__header minimal-page-header">
        <div className="atlas-ops__header-copy">
          <h1>{currentTitle}</h1>
          <p>{VIEW_DESCRIPTIONS[view]}</p>
        </div>
        <div className="atlas-ops__header-actions">
          <button className="atlas-ops__button atlas-ops__button--quiet" onClick={() => navigate("/operaciones/planificador-rutas")} type="button">Planificador de rutas</button>
          {usesServiceDate && <label className="atlas-ops__date">Fecha<input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label>}
          <button className="atlas-ops__button atlas-ops__button--quiet" onClick={() => { void refresh(); }} type="button">Actualizar</button>
        </div>
      </header>

      <nav className="atlas-ops__tabs" aria-label="Vistas de Operaciones">
        {VIEWS.map((item) => <button key={item.id} className={view === item.id ? "is-active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(`/operaciones/${item.id}`)} type="button">{item.label}</button>)}
      </nav>

      {error && <div className="atlas-ops__feedback atlas-ops__feedback--error" role="alert">{error}</div>}
      {notice && <div className="atlas-ops__feedback atlas-ops__feedback--success" role="status">{notice}</div>}

      {(view === "control-tower" || view === "excepciones") && <>
        <section className="atlas-ops__toolbar">
          <div><strong>{view === "excepciones" ? "Cola de excepciones" : "Control de la jornada"}</strong><span>{filtered.length} servicios para {day}</span></div>
          <label className="atlas-ops__search">Buscar<input type="search" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Servicio, conductor o vehículo" /></label>
          <label>Contrato<select value={filterContract} onChange={(event) => setFilterContract(event.target.value)}><option value="">Todos</option>{catalogs?.contracts.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.contract_name}</option>)}</select></label>
          {canOperate && <button className="atlas-ops__button atlas-ops__button--quiet" disabled={mutation.isPending} onClick={() => mutation.mutate(() => refreshAtlasSlaAlerts())} type="button">Evaluar hitos SLA</button>}
        </section>
        <section className="atlas-ops__metrics" aria-label="Resumen de riesgo">
          <Metric label="Críticos" value={counts.critical} tone="critical" />
          <Metric label="En riesgo" value={counts.risk} tone="risk" />
          <Metric label="Atención" value={counts.attention} tone="attention" />
          <Metric label="Normal" value={counts.green} tone="green" />
        </section>
        {view === "excepciones" && <AlertTable rows={alertQuery.data ?? []} loading={alertQuery.isLoading} onSelect={setSelectedDispatch} canOperate={canOperate} onAcknowledge={(id) => mutation.mutate(() => acknowledgeAtlasAlert(id))} onResolve={(id) => mutation.mutate(() => resolveAtlasAlert(id, "Revisada desde Control Tower"))} />}
        {view === "control-tower" && <div className="atlas-ops__work-modes" role="group" aria-label="Presentación de servicios">
          <button type="button" className={presentation === "map" ? "is-active" : ""} aria-pressed={presentation === "map"} onClick={() => setPresentation("map")}>Mapa</button>
          <button type="button" className={presentation === "list" ? "is-active" : ""} aria-pressed={presentation === "list"} onClick={() => setPresentation("list")}>Lista</button>
        </div>}
        {view === "control-tower" && dispatchQuery.isError ? (
          <div className="atlas-ops__query-error" role="alert">
            <p>No se pudo cargar la operación de esta fecha. {dispatchQuery.error instanceof Error ? dispatchQuery.error.message : "Intenta nuevamente."}</p>
            <button className="atlas-ops__button atlas-ops__button--quiet" onClick={() => { void dispatchQuery.refetch(); }} type="button">Reintentar</button>
          </div>
        ) : view === "control-tower" && presentation === "map" ? (
          <OperationsLiveMap dispatches={ordered} positions={positionsQuery.data ?? []} loading={positionsQuery.isLoading} positionError={positionsQuery.error instanceof Error ? positionsQuery.error.message : ""} onSelectDispatch={setSelectedDispatch} onPlan={() => navigate("/operaciones/planificacion")} />
        ) : view === "control-tower" && dispatchQuery.isSuccess && ordered.length === 0 ? (
          <ControlTowerEmptyState
            hasUnfilteredDispatches={(dispatchQuery.data ?? []).length > 0}
            templatesCount={catalogs?.templates.length ?? 0}
            vehiclesCount={catalogs?.vehicles.length ?? 0}
            contractsCount={editableContracts.length}
            catalogsState={catalogsQuery.isLoading ? "loading" : catalogsQuery.isError ? "error" : "ready"}
            onPlan={() => navigate("/operaciones/planificacion")}
            onConfigure={() => navigate("/operaciones/configuracion")}
            onClearFilter={() => setFilterContract("")}
          />
        ) : (
          <DispatchTable rows={view === "excepciones" ? ordered.filter((row) => row.risk_status !== "green") : ordered} loading={dispatchQuery.isLoading} onSelect={setSelectedDispatch} onTransition={(id, action) => mutation.mutate(() => transitionAtlasDispatch(id, action))} canOperate={canOperate} />
        )}
      </>}

      {view === "planificacion" && <section className="atlas-ops__workspace">
        <form className="atlas-ops__panel atlas-ops__form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submitDispatch(new FormData(event.currentTarget)); }}>
          <div className="atlas-ops__panel-heading"><div><h2>Programar servicio</h2><p>La ficha BUK exacta y su roster se validan en el servidor.</p></div><span className="atlas-ops__step">01 / PLAN</span></div>
          <div className="atlas-ops__form-grid">
            <Field label="Contrato"><select name="contract_id" required defaultValue=""><option value="" disabled>Selecciona contrato</option>{editableContracts.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.contract_name}</option>)}</select></Field>
            <Field label="Servicio base"><select name="service_template_id" required value={dispatchServiceTemplateId} onChange={(event) => { setDispatchServiceTemplateId(event.target.value); setDispatchRouteId(""); }}><option value="" disabled>Selecciona servicio</option>{catalogs?.templates.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.service_type}</option>)}</select></Field>
            <Field label="Ruta del servicio"><select name="route_id" value={dispatchRouteId} onChange={(event) => setDispatchRouteId(event.target.value)} required={(dispatchRoutesQuery.data?.filter((route) => route.is_active).length ?? 0) > 0} disabled={!dispatchServiceTemplateId || dispatchRoutesQuery.isLoading}><option value="">{dispatchRoutesQuery.isLoading ? "Cargando rutas…" : "Sin ruta asignada"}</option>{dispatchRoutesQuery.data?.filter((route) => route.is_active).map((route) => <option value={route.id} key={route.id}>{route.route_code} · versión {route.version}</option>)}</select></Field>
            <Field label="Inicio planificado"><input type="datetime-local" name="planned_start_at" required value={plannedStartLocal} onChange={(event) => setPlannedStartLocal(event.target.value)} /></Field>
            <Field label="Fin estimado"><><input type="datetime-local" name="planned_end_at" value={plannedEndLocal} readOnly /><small>{selectedDispatchRoute?.planning_duration_seconds != null ? "Calculado desde la duración vial guardada; no incluye detenciones y no se puede editar." : "Selecciona una ruta guardada con duración para calcular el término."}</small></></Field>
            <Field label="Turno"><input name="shift" placeholder="AM / PM / A / B" required /></Field>
            <Field label="Vehículo"><select name="vehicle_id" defaultValue=""><option value="">Pendiente de asignar</option>{catalogs?.vehicles.map((item) => <option value={item.id} key={item.id}>{item.code}{item.plate ? ` · ${item.plate}` : ""}</option>)}</select></Field>
            <PlanningDriverLookup serviceDate={day} disabled={!canOperate} />
            <Field label="Origen"><input name="origin_label" value={dispatchRouteEndpoints.origin} placeholder="Se obtiene de la primera dirección de la ruta" readOnly /></Field>
            <Field label="Destino / postura"><input name="destination_label" value={dispatchRouteEndpoints.destination} placeholder="Se obtiene de la última dirección de la ruta" readOnly /></Field>
            <Field label="Instrucciones" wide><textarea name="instructions" rows={3} placeholder="Indicaciones para coordinación y conductor" /></Field>
          </div>
          <div className="atlas-ops__form-footer"><span>El servicio se crea en planificación. Debe quedar listo antes de publicar.</span><button className="atlas-ops__button atlas-ops__button--primary" disabled={mutation.isPending || !canOperate}>Crear planificación</button></div>
        </form>
        <aside className="atlas-ops__side-note"><span className="atlas-ops__side-note-mark">i</span><div><strong>Validación de recursos</strong><p>Atlas comprueba ficha BUK activa, jornada en la fecha, contrato y estado del vehículo. La publicación también comprueba conflictos horarios.</p></div></aside>
      </section>}

      {view === "despacho" && <>
        <section className="atlas-ops__toolbar"><div><strong>Servicios listos para despacho</strong><span>Preparación y publicación controlada</span></div></section>
        <DispatchTable rows={ordered} loading={dispatchQuery.isLoading} onSelect={setSelectedDispatch} onTransition={(id, action) => mutation.mutate(() => transitionAtlasDispatch(id, action))} canOperate={canOperate} dispatchMode />
      </>}

      {view === "conductor" && <DriverView rows={driverDispatchQuery.data ?? []} loading={driverDispatchQuery.isLoading} onAcknowledge={(id) => mutation.mutate(() => driverAcknowledgeDispatch(id))} onIncident={(id) => setIncidentFor(id)} onOpenRoute={(id) => navigate(`/operaciones/planificador-rutas?routeId=${encodeURIComponent(id)}`)} />}

      {view === "historial" && <>
        <section className="atlas-ops__toolbar"><div><strong>Timeline de servicio</strong><span>Selecciona un servicio para revisar eventos auditables.</span></div></section>
        <DispatchTable rows={ordered} loading={dispatchQuery.isLoading} onSelect={setSelectedDispatch} onTransition={() => undefined} canOperate={false} />
      </>}

      {view === "configuracion" && <ConfigurationView contracts={editableContracts} templates={catalogs?.templates ?? []} users={adminUsersQuery.data ?? []} drivers={driverQuery.data ?? []} driverSearch={driverSearch} onDriverSearchChange={setDriverSearch} canAdmin={isAdmin} onSaveTemplate={saveTemplate} onSaveMilestone={saveMilestone} onSaveVehicle={saveVehicle} onSaveEditor={saveEditor} onBindDriver={bindDriver} pending={mutation.isPending} />}

      {selectedDispatch && <div className="atlas-ops__drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDispatch(""); }}>
        <aside className="atlas-ops__drawer" aria-label="Detalle del servicio">
          <div className="atlas-ops__drawer-header"><div><span>DETALLE OPERACIONAL</span><h2>Timeline del servicio</h2></div><button onClick={() => setSelectedDispatch("")} type="button" aria-label="Cerrar">×</button></div>
          {selectedDispatchRecord && <dl className="atlas-ops__detail-facts">
            <div><dt>Servicio</dt><dd>{selectedDispatchRecord.service_name ?? "Sin nombre"}</dd></div>
            <div><dt>Contrato</dt><dd>{selectedDispatchRecord.contract_code}</dd></div>
            <div><dt>Conductor</dt><dd>{selectedDispatchRecord.driver_name_snapshot ?? "Sin asignar"}</dd></div>
            <div><dt>Vehículo</dt><dd>{selectedDispatchRecord.vehicle_code ?? "Sin asignar"}{selectedDispatchRecord.plate ? ` · ${selectedDispatchRecord.plate}` : ""}</dd></div>
            <div><dt>Planificación</dt><dd><Status value={selectedDispatchRecord.planning_status} /></dd></div>
            <div><dt>Riesgo</dt><dd><Risk value={selectedDispatchRecord.risk_status} /></dd></div>
          </dl>}
          <h3 className="atlas-ops__timeline-title">Actividad registrada</h3>
          {eventsQuery.isLoading ? <p className="atlas-ops__timeline-state">Cargando historial…</p> : eventsQuery.isError ? <p className="atlas-ops__timeline-state" role="alert">No se pudo cargar el historial.</p> : eventsQuery.data?.length ? <ol className="atlas-ops__timeline">{eventsQuery.data.map((event) => <li key={String(event.id)}><span className="atlas-ops__timeline-dot" /><div><strong>{readableStatus(String(event.event_type))}</strong><small>{new Date(String(event.occurred_at)).toLocaleString("es-CL")} · {String(event.source)}</small></div></li>)}</ol> : <p className="atlas-ops__timeline-state">Este servicio aún no registra eventos de actividad.</p>}
        </aside>
      </div>}

      {incidentFor && <IncidentDialog pending={mutation.isPending} onClose={() => setIncidentFor("")} onSubmit={(category, severity, description) => mutation.mutate(() => driverReportIncident(incidentFor, category, severity, description))} />}
      {catalogsQuery.isError && <p className="atlas-ops__empty" role="alert">{catalogsQuery.error instanceof Error ? catalogsQuery.error.message : "No fue posible cargar catálogos."}</p>}
    </PageShell>
  );
}

function ControlTowerEmptyState({
  hasUnfilteredDispatches,
  templatesCount,
  vehiclesCount,
  contractsCount,
  catalogsState,
  onPlan,
  onConfigure,
  onClearFilter
}: {
  hasUnfilteredDispatches: boolean;
  templatesCount: number;
  vehiclesCount: number;
  contractsCount: number;
  catalogsState: "loading" | "error" | "ready";
  onPlan: () => void;
  onConfigure: () => void;
  onClearFilter: () => void;
}) {
  return <section className="atlas-ops__empty-dashboard" aria-label="Estado de la operación">
    <article className="atlas-ops__panel atlas-ops__empty-welcome">
      <span className="atlas-ops__eyebrow">INICIO DE JORNADA</span>
      <div className="atlas-ops__empty-count" aria-label="Cero servicios">0</div>
      <h2>{hasUnfilteredDispatches ? "No hay resultados para este contrato" : "La jornada está lista para planificarse"}</h2>
      <p>{hasUnfilteredDispatches ? "Hay servicios en esta fecha. Cambia el contrato seleccionado para volver a verlos." : "Al crear la primera planificación, los despachos, hitos y alertas de esta fecha aparecerán aquí."}</p>
      {hasUnfilteredDispatches
        ? <button className="atlas-ops__button atlas-ops__button--quiet" onClick={onClearFilter} type="button">Ver todos los contratos</button>
        : <button className="atlas-ops__button atlas-ops__button--primary" onClick={onPlan} type="button">Programar primer servicio</button>}
    </article>
    <article className="atlas-ops__panel atlas-ops__readiness">
      <div className="atlas-ops__panel-heading"><div><h2>Preparación operacional</h2><p>Estado actual de los catálogos e integración.</p></div></div>
      <div className="atlas-ops__readiness-list">
        <ReadinessRow label="Contratos disponibles" value={catalogsState === "ready" ? String(contractsCount) : catalogsState === "loading" ? "…" : "—"} status={catalogReadinessStatus(catalogsState, contractsCount)} />
        <ReadinessRow label="Servicios base" value={catalogsState === "ready" ? String(templatesCount) : catalogsState === "loading" ? "…" : "—"} status={catalogReadinessStatus(catalogsState, templatesCount)} />
        <ReadinessRow label="Vehículos activos" value={catalogsState === "ready" ? String(vehiclesCount) : catalogsState === "loading" ? "…" : "—"} status={catalogReadinessStatus(catalogsState, vehiclesCount)} />
        <ReadinessRow label="Telemetría TrackTec" value="—" status="Pendiente de integración" />
      </div>
      <button className="atlas-ops__button atlas-ops__button--quiet" onClick={onConfigure} type="button">Revisar configuración</button>
    </article>
  </section>;
}

function ReadinessRow({ label, value, status }: { label: string; value: string; status: string }) {
  return <div className="atlas-ops__readiness-row"><span>{label}</span><strong>{value}</strong><small>{status}</small></div>;
}

function catalogReadinessStatus(state: "loading" | "error" | "ready", count: number) {
  if (state === "loading") return "Cargando";
  if (state === "error") return "Sin conexión";
  return count > 0 ? "Listo" : "Pendiente";
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`atlas-ops__metric atlas-ops__metric--${tone}`}><span>{label}</span><strong>{value}</strong><i /></div>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`atlas-ops__field${wide ? " atlas-ops__field--wide" : ""}`}><span>{label}</span>{children}</label>;
}

function DispatchTable({ rows, loading, onSelect, onTransition, canOperate, dispatchMode = false }: {
  rows: AtlasDispatch[]; loading: boolean; onSelect: (id: string) => void; onTransition: (id: string, action: string) => void; canOperate: boolean; dispatchMode?: boolean;
}) {
  return <div className="atlas-ops__table-wrap"><table className="atlas-ops__table"><thead><tr><th>Servicio / Hora</th><th>Contrato</th><th>Conductor</th><th>Vehículo</th><th>Plan</th><th>Ejecución</th><th>Riesgo</th><th /></tr></thead>
    <tbody>{loading ? <tr><td colSpan={8}>Cargando servicios…</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="atlas-ops__empty">Sin servicios para los filtros seleccionados.</td></tr> : rows.map((row) => <tr key={row.id}>
      <td data-label="Servicio / Hora"><button className="atlas-ops__service-link" onClick={() => onSelect(row.id)} type="button">{row.service_name ?? "Servicio importado"}<small>{row.planned_start_at ? new Date(row.planned_start_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "Hora pendiente"} · {row.shift}</small></button></td>
      <td data-label="Contrato">{row.contract_code}</td><td data-label="Conductor">{row.driver_name_snapshot ?? <span className="atlas-ops__muted">Sin asignar</span>}</td>
      <td data-label="Vehículo">{row.vehicle_code ?? <span className="atlas-ops__muted">Sin asignar</span>}{row.plate ? <small className="atlas-ops__cell-sub">{row.plate}</small> : null}</td>
      <td data-label="Plan"><Status value={row.planning_status} /></td><td data-label="Ejecución">{readableStatus(row.execution_status)}</td><td data-label="Riesgo"><Risk value={row.risk_status} /></td>
      <td data-label="Acciones" className="atlas-ops__actions">{canOperate && row.planning_status === "planning" && <button onClick={() => onTransition(row.id, "ready")} type="button">Validar</button>}{canOperate && row.planning_status === "ready" && <button onClick={() => onTransition(row.id, "publish")} type="button">Publicar</button>}{dispatchMode && row.execution_status === "not_started" && row.acknowledged_at && <button onClick={() => onTransition(row.id, "start")} type="button">Iniciar</button>}</td>
    </tr>)}</tbody></table></div>;
}

function AlertTable({ rows, loading, onSelect, canOperate, onAcknowledge, onResolve }: {
  rows: Array<Record<string, unknown>>; loading: boolean; onSelect: (id: string) => void; canOperate: boolean;
  onAcknowledge: (id: string) => void; onResolve: (id: string) => void;
}) {
  return <section className="atlas-ops__panel atlas-ops__alert-list"><div className="atlas-ops__panel-heading"><div><h2>Alertas activas</h2><p>Los eventos y la atención quedan en el historial del servicio.</p></div></div>
    <div className="atlas-ops__table-wrap"><table className="atlas-ops__table"><thead><tr><th>Severidad</th><th>Excepción</th><th>Estado</th><th>Desde</th><th /></tr></thead><tbody>
      {loading ? <tr><td colSpan={5}>Cargando alertas…</td></tr> : rows.length === 0 ? <tr><td className="atlas-ops__empty" colSpan={5}>No hay alertas activas para esta fecha.</td></tr> : rows.map((row) => <tr key={String(row.id)}>
        <td data-label="Severidad"><Risk value={String(row.alert_type)} /></td><td data-label="Excepción"><button className="atlas-ops__service-link" onClick={() => onSelect(String(row.dispatch_id))} type="button">{String(row.message)}</button></td>
        <td data-label="Estado"><Status value={String(row.status)} /></td><td data-label="Desde">{new Date(String(row.opened_at)).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</td>
        <td data-label="Acciones" className="atlas-ops__actions">{canOperate && row.status === "open" && <button onClick={() => onAcknowledge(String(row.id))} type="button">Atender</button>}{canOperate && <button onClick={() => onResolve(String(row.id))} type="button">Resolver</button>}</td>
      </tr>)}
    </tbody></table></div>
  </section>;
}

function Status({ value }: { value: string }) { return <span className={`atlas-ops__status atlas-ops__status--${value}`}>{readableStatus(value)}</span>; }
function Risk({ value }: { value: string }) { return <span className={`atlas-ops__risk atlas-ops__risk--${value}`}><i />{value === "green" ? "Normal" : readableStatus(value)}</span>; }

function DriverView({ rows, loading, onAcknowledge, onIncident, onOpenRoute }: { rows: Record<string, unknown>[]; loading: boolean; onAcknowledge: (id: string) => void; onIncident: (id: string) => void; onOpenRoute: (id: string) => void }) {
  return <section className="atlas-ops__driver-list"><div className="atlas-ops__toolbar"><div><strong>Mis próximos servicios</strong><span>Acceso asociado a una identidad BUK verificada.</span></div></div>
    {loading ? <p className="atlas-ops__empty">Cargando servicios…</p> : rows.length === 0 ? <div className="atlas-ops__panel atlas-ops__empty">No hay servicios publicados para esta cuenta. Si eres conductor, solicita a administración vincular tu cuenta Atlas con tu ficha BUK exacta.</div> : rows.map((row) => <article className="atlas-ops__driver-card" key={String(row.id)}><div><span className="atlas-ops__eyebrow">{String(row.shift)} · {String(row.service_date)}</span><h2>{String(row.service_name ?? "Servicio asignado")}</h2><p>{String(row.origin_label ?? "Origen pendiente")} → {String(row.destination_label ?? "Destino pendiente")}</p><div className="atlas-ops__driver-facts"><span>{row.planned_start_at ? new Date(String(row.planned_start_at)).toLocaleString("es-CL") : "Horario pendiente"}</span><span>Vehículo {String(row.vehicle_code ?? "pendiente")}{row.plate ? ` · ${String(row.plate)}` : ""}</span>{typeof row.route_code === "string" && <span>Ruta {row.route_code}</span>}</div><p>{String(row.instructions ?? "")}</p></div><div className="atlas-ops__driver-actions">{typeof row.route_id === "string" && <button className="atlas-ops__button atlas-ops__button--primary" onClick={() => onOpenRoute(row.route_id as string)} type="button">Ver ruta asignada</button>}{!row.acknowledged_at && <button className="atlas-ops__button atlas-ops__button--primary" onClick={() => onAcknowledge(String(row.id))} type="button">Confirmar recepción</button>}<button className="atlas-ops__button atlas-ops__button--quiet" onClick={() => onIncident(String(row.id))} type="button">Reportar incidencia</button></div></article>)}</section>;
}

function ConfigurationView({ contracts, templates, users, drivers, driverSearch, onDriverSearchChange, canAdmin, onSaveTemplate, onSaveMilestone, onSaveVehicle, onSaveEditor, onBindDriver, pending }: {
  contracts: Array<{ id: number; code: string; contract_name: string }>; templates: Array<{ id: number; contract_id: number; name: string; service_type: string }>;
  users: Array<{ id: string; email: string; full_name: string }>; drivers: Array<{ buk_employee_id: string; full_name: string; display_label: string }>;
  driverSearch: string; onDriverSearchChange: (value: string) => void;
  canAdmin: boolean; onSaveTemplate: (form: FormData, operatingDays: string[], shifts: string[]) => Promise<void>; onSaveMilestone: (form: FormData) => Promise<void>;
  onSaveVehicle: (form: FormData) => Promise<void>; onSaveEditor: (form: FormData) => Promise<void>; onBindDriver: (form: FormData) => Promise<void>; pending: boolean;
}) {
  const [operatingDays, setOperatingDays] = useState<string[]>([]);
  const [shifts, setShifts] = useState<string[]>([]);
  const [daysError, setDaysError] = useState(false);
  const [shiftsError, setShiftsError] = useState(false);
  const weekdays = [
    { value: "1", label: "Lunes" }, { value: "2", label: "Martes" },
    { value: "3", label: "Miércoles" }, { value: "4", label: "Jueves" },
    { value: "5", label: "Viernes" }, { value: "6", label: "Sábado" },
    { value: "7", label: "Domingo" }
  ];
  const shiftOptions = [
    { value: "AM (A)", label: "AM (A)" },
    { value: "PM (C)", label: "PM (C)" }
  ];
  async function submitServiceTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingDays = operatingDays.length === 0;
    const missingShifts = shifts.length === 0;
    setDaysError(missingDays);
    setShiftsError(missingShifts);
    if (missingDays || missingShifts) return;
    setDaysError(false);
    setShiftsError(false);
    await onSaveTemplate(new FormData(event.currentTarget), operatingDays, shifts);
  }
  return <section className="atlas-ops__config-grid">
    <form className="atlas-ops__panel atlas-ops__form" onSubmit={(event: FormEvent<HTMLFormElement>) => { void submitServiceTemplate(event); }}><div className="atlas-ops__panel-heading"><div><h2>Nuevo servicio base</h2><p>Catálogo propio de Atlas Operations.</p></div></div><div className="atlas-ops__form-grid">
      <Field label="Contrato"><select name="contract_id" required defaultValue=""><option value="" disabled>Selecciona</option>{contracts.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.contract_name}</option>)}</select></Field>
      <Field label="Nombre"><input name="name" required /></Field><Field label="Tipo"><input name="service_type" required /></Field>
      <Field label="Proveedor"><input name="provider_name" /></Field><Field label="Nombre contractual"><input name="contractual_name" /></Field>
      <div><MultiSelectField id="service-shifts" label="Jornada" className="atlas-ops__field" value={shifts} onChange={(values) => { setShifts(values); if (values.length) setShiftsError(false); }} options={shiftOptions} placeholder="Selecciona AM o PM" triggerStyle={{ height: "var(--ops-control-height)", minHeight: "var(--ops-control-height)", flexWrap: "nowrap", boxSizing: "border-box" }} /><small style={{ display: "block", marginTop: "0.25rem", color: "var(--ops-muted)", fontSize: "0.65rem", fontWeight: 400 }}>Elige AM (A), PM (C) o ambas.</small>{shiftsError && <small role="alert" style={{ display: "block", color: "#b42318", fontSize: "0.65rem" }}>Selecciona al menos una jornada.</small>}</div>
      <div><MultiSelectField id="service-operating-days" label="Días de operación" className="atlas-ops__field" value={operatingDays} onChange={(days) => { setOperatingDays(days); if (days.length) setDaysError(false); }} options={weekdays} placeholder="Selecciona los días" triggerStyle={{ height: "var(--ops-control-height)", minHeight: "var(--ops-control-height)", flexWrap: "nowrap", boxSizing: "border-box" }} /><small style={{ display: "block", marginTop: "0.25rem", color: "var(--ops-muted)", fontSize: "0.65rem", fontWeight: 400 }}>Elige uno o más días de la semana.</small>{daysError && <small role="alert" style={{ display: "block", color: "#b42318", fontSize: "0.65rem" }}>Selecciona al menos un día.</small>}</div>
    </div><button className="atlas-ops__button atlas-ops__button--primary" disabled={pending || !canAdmin}>Agregar servicio</button></form>
    <form className="atlas-ops__panel atlas-ops__form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void onSaveMilestone(new FormData(event.currentTarget)); }}><div className="atlas-ops__panel-heading"><div><h2>Versión de hitos SLA</h2><p>Las nuevas reglas aplican a despachos futuros.</p></div></div><div className="atlas-ops__form-grid">
      <Field label="Contrato"><select name="contract_id" required defaultValue=""><option value="" disabled>Selecciona</option>{contracts.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.contract_name}</option>)}</select></Field>
      <Field label="Servicio base"><select name="service_template_id" defaultValue=""><option value="">Todos los servicios del contrato</option>{templates.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Código"><input name="code" placeholder="ARRIVAL_POSTURE" required /></Field><Field label="Nombre"><input name="label" required /></Field>
      <Field label="Minutos respecto al inicio"><input type="number" name="offset_minutes" required /></Field><Field label="Aviso anticipado (min)"><input type="number" name="warning_before_minutes" defaultValue="15" /></Field>
      <Field label="Tipo de geocerca"><select name="geofence_type"><option value="">Sin automatización GPS</option><option value="workshop">Taller</option><option value="posture">Postura</option><option value="site">Faena</option><option value="route">Ruta</option></select></Field>
      <label className="atlas-ops__check"><input type="checkbox" name="required" value="true" defaultChecked /> Hito obligatorio</label>
    </div><button className="atlas-ops__button atlas-ops__button--primary" disabled={pending || !canAdmin}>Publicar nueva versión</button></form>
    <form className="atlas-ops__panel atlas-ops__form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void onSaveVehicle(new FormData(event.currentTarget)); }}><div className="atlas-ops__panel-heading"><div><h2>Alta de vehículo</h2><p>El padrón parte vacío; registra la flota autorizada.</p></div></div><div className="atlas-ops__form-grid">
      <Field label="Código"><input name="code" required /></Field><Field label="Patente"><input name="plate" /></Field><Field label="Tipo"><input name="vehicle_type" /></Field><Field label="Cliente"><input name="client_label" /></Field>
    </div><button className="atlas-ops__button atlas-ops__button--primary" disabled={pending || !canAdmin}>Agregar vehículo</button></form>
    <form className="atlas-ops__panel atlas-ops__form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void onSaveEditor(new FormData(event.currentTarget)); }}><div className="atlas-ops__panel-heading"><div><h2>Acceso de Operaciones</h2><p>Asigna usuarios L1/L2 a contratos; el backend valida su rol.</p></div></div><div className="atlas-ops__form-grid">
      <Field label="Usuario"><select name="user_id" required defaultValue=""><option value="" disabled>Selecciona cuenta</option>{users.map((user) => <option value={user.id} key={user.id}>{user.full_name || user.email} · {user.email}</option>)}</select></Field>
      <Field label="Contrato"><select name="contract_id" required defaultValue=""><option value="" disabled>Selecciona contrato</option>{contracts.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.contract_name}</option>)}</select></Field>
    </div><button className="atlas-ops__button atlas-ops__button--primary" disabled={pending || !canAdmin}>Asignar contrato</button></form>
    <form className="atlas-ops__panel atlas-ops__form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void onBindDriver(new FormData(event.currentTarget)); }}><div className="atlas-ops__panel-heading"><div><h2>Vincular conductor Atlas</h2><p>Asocia una cuenta a una ficha BUK exacta para habilitar su vista personal.</p></div></div><div className="atlas-ops__form-grid">
      <Field label="Cuenta Atlas"><select name="user_id" required defaultValue=""><option value="" disabled>Selecciona cuenta</option>{users.map((user) => <option value={user.id} key={user.id}>{user.full_name || user.email} · {user.email}</option>)}</select></Field>
      <Field label="Buscar ficha BUK"><input value={driverSearch} onChange={(event) => onDriverSearchChange(event.target.value)} placeholder="Nombre o RUT" /></Field>
      <Field label="Ficha BUK activa"><select name="buk_employee_id" required defaultValue=""><option value="" disabled>Selecciona resultado</option>{drivers.map((driver) => <option value={driver.buk_employee_id} key={driver.buk_employee_id}>{driver.display_label}</option>)}</select></Field>
    </div><button className="atlas-ops__button atlas-ops__button--primary" disabled={pending || !canAdmin}>Vincular ficha BUK</button></form>
    <div className="atlas-ops__panel atlas-ops__integration-note"><span className="atlas-ops__eyebrow">TELEMETRÍA</span><h2>TrackTec real desactivado</h2><p>El gateway queda separado y el simulador se limita a administración. Para activar TrackTec faltan su contrato técnico oficial y credenciales server-side.</p></div>
  </section>;
}

function IncidentDialog({ pending, onClose, onSubmit }: { pending: boolean; onClose: () => void; onSubmit: (category: string, severity: string, description: string) => void }) {
  return <div className="atlas-ops__modal-backdrop"><form className="atlas-ops__modal" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSubmit(String(form.get("category")), String(form.get("severity")), String(form.get("description"))); onClose(); }}>
    <div className="atlas-ops__panel-heading"><div><h2>Reportar incidencia</h2><p>El registro quedará asociado al servicio y a tu cuenta.</p></div><button onClick={onClose} type="button">×</button></div>
    <div className="atlas-ops__form-grid"><Field label="Categoría"><input name="category" required /></Field><Field label="Severidad"><select name="severity"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></Field><Field label="Descripción" wide><textarea name="description" rows={4} minLength={5} required /></Field></div>
    <div className="atlas-ops__form-footer"><button className="atlas-ops__button atlas-ops__button--quiet" onClick={onClose} type="button">Cancelar</button><button className="atlas-ops__button atlas-ops__button--primary" disabled={pending}>Enviar incidencia</button></div>
  </form></div>;
}
