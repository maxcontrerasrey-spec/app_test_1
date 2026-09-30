import { useEffect, useMemo, useState, type ReactNode, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/context/AuthContext";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { purgeLegacyOperationsDrafts } from "../lib/legacyCleanup";
import {
  createAtlasDispatch,
  driverAcknowledgeDispatch,
  bindAtlasDriverAccount,
  driverReportIncident,
  getAtlasDispatchEvents,
  getAtlasDispatches,
  getAtlasDriverDispatches,
  getAtlasOperationsCatalogs,
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
  type AtlasDispatch
} from "../services/atlasOperationsApi";
import "../styles/atlas-operations.css";

type View = "control-tower" | "planificacion" | "despacho" | "excepciones" | "conductor" | "historial" | "configuracion";
const VIEWS: Array<{ id: View; label: string }> = [
  { id: "control-tower", label: "Control Tower" },
  { id: "planificacion", label: "Planificación" },
  { id: "despacho", label: "Despacho" },
  { id: "excepciones", label: "Excepciones" },
  { id: "conductor", label: "Conductor" },
  { id: "historial", label: "Historial" },
  { id: "configuracion", label: "Configuración" }
];

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readableStatus(value: string) {
  return value.replace(/_/g, " ");
}

export function OperationsControlTowerPage() {
  useEffect(() => { purgeLegacyOperationsDrafts(); }, []);
  const { view: routeView } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const isAdmin = auth.isSuperAdmin;
  const canOperate = auth.isSuperAdmin;
  const view = (VIEWS.some((item) => item.id === routeView) ? routeView : "control-tower") as View;
  const [day, setDay] = useState(localDate());
  const [filterContract, setFilterContract] = useState("");
  const [selectedDispatch, setSelectedDispatch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [incidentFor, setIncidentFor] = useState("");

  const catalogsQuery = useQuery({ queryKey: queryKeys.operations.catalogs(), queryFn: getAtlasOperationsCatalogs, staleTime: 30_000 });
  const dispatchQuery = useQuery({ queryKey: queryKeys.operations.dispatches(day), queryFn: () => getAtlasDispatches(day, day), staleTime: 10_000 });
  const alertDispatchIds = (dispatchQuery.data ?? []).map((row) => row.id);
  const alertQuery = useQuery({ queryKey: queryKeys.operations.alerts(day, alertDispatchIds), queryFn: () => getAtlasAlerts(alertDispatchIds), enabled: (view === "excepciones" || view === "control-tower") && dispatchQuery.isSuccess, staleTime: 10_000 });
  const driverQuery = useQuery({ queryKey: queryKeys.operations.driverSearch({ search: driverSearch, day }), queryFn: () => searchAtlasDrivers(driverSearch, day), enabled: canOperate && driverSearch.trim().length >= 2, staleTime: 15_000 });
  const driverDispatchQuery = useQuery({ queryKey: queryKeys.operations.driverDispatches(), queryFn: getAtlasDriverDispatches, enabled: view === "conductor", retry: false });
  const eventsQuery = useQuery({ queryKey: queryKeys.operations.events(selectedDispatch), queryFn: () => getAtlasDispatchEvents(selectedDispatch), enabled: Boolean(selectedDispatch) });
  const adminUsersQuery = useQuery({ queryKey: queryKeys.operations.adminUsers(), queryFn: getAtlasAdminUsers, enabled: view === "configuracion" && isAdmin });

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.operations.all() });
  useRealtimeQueryInvalidation({
    channelName: "atlas-operations-live",
    subscriptions: [
      { table: "atlas_ops_dispatches" },
      { table: "atlas_ops_dispatch_events" },
      { table: "atlas_ops_alerts" },
      { table: "atlas_ops_telemetry_events" }
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

  const filtered = (dispatchQuery.data ?? []).filter((row) => !filterContract || String(row.contract_id) === filterContract);
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

  async function submitDispatch(form: FormData) {
    const contractId = Number(form.get("contract_id"));
    const localStart = String(form.get("planned_start_at") ?? "");
    const localEnd = String(form.get("planned_end_at") ?? "");
    const start = new Date(localStart);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    await mutation.mutateAsync(() => createAtlasDispatch({
      contract_id: contractId,
      service_template_id: Number(form.get("service_template_id")) || null,
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

  async function saveTemplate(form: FormData) {
    await mutation.mutateAsync(() => saveAtlasServiceTemplate(Object.fromEntries(form.entries())));
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
    <main className="atlas-ops">
      <header className="atlas-ops__header">
        <div>
          <div className="atlas-ops__eyebrow">ATLAS / OPERACIONES</div>
          <h1>{currentTitle}</h1>
          <p>Plan operativo, asignaciones y gestión por excepciones.</p>
        </div>
        <div className="atlas-ops__header-actions">
          <label className="atlas-ops__date">Fecha<input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label>
          <button className="atlas-ops__button atlas-ops__button--quiet" onClick={() => { void refresh(); }} type="button">Actualizar</button>
        </div>
      </header>

      <nav className="atlas-ops__tabs" aria-label="Vistas de Operaciones">
        {VIEWS.map((item) => <button key={item.id} className={view === item.id ? "is-active" : ""} onClick={() => navigate(`/operaciones/${item.id}`)} type="button">{item.label}</button>)}
      </nav>

      {error && <div className="atlas-ops__feedback atlas-ops__feedback--error" role="alert">{error}</div>}
      {notice && <div className="atlas-ops__feedback atlas-ops__feedback--success" role="status">{notice}</div>}

      {(view === "control-tower" || view === "excepciones") && <>
        <section className="atlas-ops__toolbar">
          <div><strong>{view === "excepciones" ? "Cola de excepciones" : "Prioridad operacional"}</strong><span>{filtered.length} servicios para {day}</span></div>
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
        <DispatchTable rows={view === "excepciones" ? ordered.filter((row) => row.risk_status !== "green") : ordered} loading={dispatchQuery.isLoading} onSelect={setSelectedDispatch} onTransition={(id, action) => mutation.mutate(() => transitionAtlasDispatch(id, action))} canOperate={canOperate} />
      </>}

      {view === "planificacion" && <section className="atlas-ops__workspace">
        <form className="atlas-ops__panel atlas-ops__form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submitDispatch(new FormData(event.currentTarget)); }}>
          <div className="atlas-ops__panel-heading"><div><h2>Programar servicio</h2><p>La ficha BUK exacta y su roster se validan en el servidor.</p></div><span className="atlas-ops__step">01 / PLAN</span></div>
          <div className="atlas-ops__form-grid">
            <Field label="Contrato"><select name="contract_id" required defaultValue=""><option value="" disabled>Selecciona contrato</option>{editableContracts.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.contract_name}</option>)}</select></Field>
            <Field label="Servicio base"><select name="service_template_id" required defaultValue=""><option value="" disabled>Selecciona servicio</option>{catalogs?.templates.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.service_type}</option>)}</select></Field>
            <Field label="Inicio planificado"><input type="datetime-local" name="planned_start_at" required /></Field>
            <Field label="Fin estimado"><input type="datetime-local" name="planned_end_at" /></Field>
            <Field label="Turno"><input name="shift" placeholder="AM / PM / A / B" required /></Field>
            <Field label="Vehículo"><select name="vehicle_id" defaultValue=""><option value="">Pendiente de asignar</option>{catalogs?.vehicles.map((item) => <option value={item.id} key={item.id}>{item.code}{item.plate ? ` · ${item.plate}` : ""}</option>)}</select></Field>
            <Field label="Conductor BUK"><input autoComplete="off" value={driverSearch} onChange={(event) => setDriverSearch(event.target.value)} placeholder="Nombre o RUT" /></Field>
            <div className="atlas-ops__driver-results" role="listbox" aria-label="Resultados de conductor">
              {driverQuery.data?.map((driver) => <label className="atlas-ops__driver-option" key={driver.buk_employee_id}>
                <input type="radio" name="driver_buk_employee_id" value={driver.buk_employee_id} required />
                <span><strong>{driver.full_name}</strong><small>{driver.document_number} · {driver.contract_code ?? "Sin contrato"} · {driver.is_working_day && !driver.is_rest_day ? "En jornada" : "Jornada no validada"}</small></span>
              </label>)}
              {driverSearch.trim().length >= 2 && driverQuery.data?.length === 0 && <small>No hay coincidencias activas con jornada disponible.</small>}
            </div>
            <Field label="Origen"><input name="origin_label" placeholder="Taller / terminal" /></Field>
            <Field label="Destino / postura"><input name="destination_label" placeholder="Faena o punto de servicio" /></Field>
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

      {view === "conductor" && <DriverView rows={driverDispatchQuery.data ?? []} loading={driverDispatchQuery.isLoading} onAcknowledge={(id) => mutation.mutate(() => driverAcknowledgeDispatch(id))} onIncident={(id) => setIncidentFor(id)} />}

      {view === "historial" && <>
        <section className="atlas-ops__toolbar"><div><strong>Timeline de servicio</strong><span>Selecciona un servicio para revisar eventos auditables.</span></div></section>
        <DispatchTable rows={ordered} loading={dispatchQuery.isLoading} onSelect={setSelectedDispatch} onTransition={() => undefined} canOperate={false} />
      </>}

      {view === "configuracion" && <ConfigurationView contracts={editableContracts} templates={catalogs?.templates ?? []} users={adminUsersQuery.data ?? []} drivers={driverQuery.data ?? []} driverSearch={driverSearch} onDriverSearchChange={setDriverSearch} canAdmin={isAdmin} onSaveTemplate={saveTemplate} onSaveMilestone={saveMilestone} onSaveVehicle={saveVehicle} onSaveEditor={saveEditor} onBindDriver={bindDriver} pending={mutation.isPending} />}

      {selectedDispatch && <div className="atlas-ops__drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDispatch(""); }}>
        <aside className="atlas-ops__drawer" aria-label="Detalle del servicio">
          <div className="atlas-ops__drawer-header"><div><span>DETALLE OPERACIONAL</span><h2>Timeline del servicio</h2></div><button onClick={() => setSelectedDispatch("")} type="button" aria-label="Cerrar">×</button></div>
          {eventsQuery.isLoading ? <p>Cargando historial…</p> : <ol className="atlas-ops__timeline">{eventsQuery.data?.map((event) => <li key={String(event.id)}><span className="atlas-ops__timeline-dot" /><div><strong>{readableStatus(String(event.event_type))}</strong><small>{new Date(String(event.occurred_at)).toLocaleString("es-CL")} · {String(event.source)}</small></div></li>)}</ol>}
        </aside>
      </div>}

      {incidentFor && <IncidentDialog pending={mutation.isPending} onClose={() => setIncidentFor("")} onSubmit={(category, severity, description) => mutation.mutate(() => driverReportIncident(incidentFor, category, severity, description))} />}
      {catalogsQuery.isError && <p className="atlas-ops__empty">{catalogsQuery.error instanceof Error ? catalogsQuery.error.message : "No fue posible cargar catálogos."}</p>}
    </main>
  );
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
      <td><button className="atlas-ops__service-link" onClick={() => onSelect(row.id)} type="button">{row.service_name ?? "Servicio importado"}<small>{row.planned_start_at ? new Date(row.planned_start_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "Hora pendiente"} · {row.shift}</small></button></td>
      <td>{row.contract_code}</td><td>{row.driver_name_snapshot ?? <span className="atlas-ops__muted">Sin asignar</span>}</td>
      <td>{row.vehicle_code ?? <span className="atlas-ops__muted">Sin asignar</span>}{row.plate ? <small className="atlas-ops__cell-sub">{row.plate}</small> : null}</td>
      <td><Status value={row.planning_status} /></td><td>{readableStatus(row.execution_status)}</td><td><Risk value={row.risk_status} /></td>
      <td className="atlas-ops__actions">{canOperate && row.planning_status === "planning" && <button onClick={() => onTransition(row.id, "ready")} type="button">Validar</button>}{canOperate && row.planning_status === "ready" && <button onClick={() => onTransition(row.id, "publish")} type="button">Publicar</button>}{dispatchMode && row.execution_status === "not_started" && row.acknowledged_at && <button onClick={() => onTransition(row.id, "start")} type="button">Iniciar</button>}</td>
    </tr>)}</tbody></table></div>;
}

function AlertTable({ rows, loading, onSelect, canOperate, onAcknowledge, onResolve }: {
  rows: Array<Record<string, unknown>>; loading: boolean; onSelect: (id: string) => void; canOperate: boolean;
  onAcknowledge: (id: string) => void; onResolve: (id: string) => void;
}) {
  return <section className="atlas-ops__panel atlas-ops__alert-list"><div className="atlas-ops__panel-heading"><div><h2>Alertas activas</h2><p>Los eventos y la atención quedan en el historial del servicio.</p></div></div>
    <div className="atlas-ops__table-wrap"><table className="atlas-ops__table"><thead><tr><th>Severidad</th><th>Excepción</th><th>Estado</th><th>Desde</th><th /></tr></thead><tbody>
      {loading ? <tr><td colSpan={5}>Cargando alertas…</td></tr> : rows.length === 0 ? <tr><td className="atlas-ops__empty" colSpan={5}>No hay alertas activas para esta fecha.</td></tr> : rows.map((row) => <tr key={String(row.id)}>
        <td><Risk value={String(row.alert_type)} /></td><td><button className="atlas-ops__service-link" onClick={() => onSelect(String(row.dispatch_id))} type="button">{String(row.message)}</button></td>
        <td><Status value={String(row.status)} /></td><td>{new Date(String(row.opened_at)).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</td>
        <td className="atlas-ops__actions">{canOperate && row.status === "open" && <button onClick={() => onAcknowledge(String(row.id))} type="button">Atender</button>}{canOperate && <button onClick={() => onResolve(String(row.id))} type="button">Resolver</button>}</td>
      </tr>)}
    </tbody></table></div>
  </section>;
}

function Status({ value }: { value: string }) { return <span className={`atlas-ops__status atlas-ops__status--${value}`}>{readableStatus(value)}</span>; }
function Risk({ value }: { value: string }) { return <span className={`atlas-ops__risk atlas-ops__risk--${value}`}><i />{value === "green" ? "Normal" : readableStatus(value)}</span>; }

function DriverView({ rows, loading, onAcknowledge, onIncident }: { rows: Record<string, unknown>[]; loading: boolean; onAcknowledge: (id: string) => void; onIncident: (id: string) => void }) {
  return <section className="atlas-ops__driver-list"><div className="atlas-ops__toolbar"><div><strong>Mis próximos servicios</strong><span>Acceso asociado a una identidad BUK verificada.</span></div></div>
    {loading ? <p className="atlas-ops__empty">Cargando servicios…</p> : rows.length === 0 ? <div className="atlas-ops__panel atlas-ops__empty">No hay servicios publicados para esta cuenta. Si eres conductor, solicita a administración vincular tu cuenta Atlas con tu ficha BUK exacta.</div> : rows.map((row) => <article className="atlas-ops__driver-card" key={String(row.id)}><div><span className="atlas-ops__eyebrow">{String(row.shift)} · {String(row.service_date)}</span><h2>{String(row.service_name ?? "Servicio asignado")}</h2><p>{String(row.origin_label ?? "Origen pendiente")} → {String(row.destination_label ?? "Destino pendiente")}</p><div className="atlas-ops__driver-facts"><span>{row.planned_start_at ? new Date(String(row.planned_start_at)).toLocaleString("es-CL") : "Horario pendiente"}</span><span>Vehículo {String(row.vehicle_code ?? "pendiente")}{row.plate ? ` · ${String(row.plate)}` : ""}</span></div><p>{String(row.instructions ?? "")}</p></div><div className="atlas-ops__driver-actions">{!row.acknowledged_at && <button className="atlas-ops__button atlas-ops__button--primary" onClick={() => onAcknowledge(String(row.id))} type="button">Confirmar recepción</button>}<button className="atlas-ops__button atlas-ops__button--quiet" onClick={() => onIncident(String(row.id))} type="button">Reportar incidencia</button></div></article>)}</section>;
}

function ConfigurationView({ contracts, templates, users, drivers, driverSearch, onDriverSearchChange, canAdmin, onSaveTemplate, onSaveMilestone, onSaveVehicle, onSaveEditor, onBindDriver, pending }: {
  contracts: Array<{ id: number; code: string; contract_name: string }>; templates: Array<{ id: number; contract_id: number; name: string; service_type: string }>;
  users: Array<{ id: string; email: string; full_name: string }>; drivers: Array<{ buk_employee_id: string; full_name: string; display_label: string }>;
  driverSearch: string; onDriverSearchChange: (value: string) => void;
  canAdmin: boolean; onSaveTemplate: (form: FormData) => Promise<void>; onSaveMilestone: (form: FormData) => Promise<void>;
  onSaveVehicle: (form: FormData) => Promise<void>; onSaveEditor: (form: FormData) => Promise<void>; onBindDriver: (form: FormData) => Promise<void>; pending: boolean;
}) {
  return <section className="atlas-ops__config-grid">
    <form className="atlas-ops__panel atlas-ops__form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void onSaveTemplate(new FormData(event.currentTarget)); }}><div className="atlas-ops__panel-heading"><div><h2>Nuevo servicio base</h2><p>Catálogo propio de Atlas Operations.</p></div></div><div className="atlas-ops__form-grid">
      <Field label="Contrato"><select name="contract_id" required defaultValue=""><option value="" disabled>Selecciona</option>{contracts.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.contract_name}</option>)}</select></Field>
      <Field label="Nombre"><input name="name" required /></Field><Field label="Tipo"><input name="service_type" required /></Field>
      <Field label="Proveedor"><input name="provider_name" /></Field><Field label="Nombre contractual"><input name="contractual_name" /></Field><Field label="Jornada"><input name="schedule_label" /></Field>
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
