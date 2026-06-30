import { useCallback, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DatePickerField, PageShell, SelectField, TextField } from "../../../shared/ui";
import { formatRequestDate, formatPersonLabel } from "../../../shared/lib/format";
import { addMonthsToDateValue, getDaysSince, toMonthInputValue, toTodayDateValue } from "../../../shared/lib/date";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { hasFeatureAccess } from "../../auth/config/access";
import { useAuth } from "../../auth/context/AuthContext";
import {
  invalidateRosterQueries,
  useRosterCalendarSummary,
  useRosterSetupCatalogs,
  useWorkerSchedule
} from "../hooks/useRosterQueries";
import {
  assignWorkerRoster,
  setRosterExceptionStatus,
  upsertRosterException
} from "../services/rosterApi";
import type {
  RosterExceptionSource,
  RosterExceptionType,
  RosterWorkerSearchItem,
  WorkerScheduleDay
} from "../types";
import { RosterAssignmentDialog } from "../components/RosterAssignmentDialog";
import { RosterCalendar } from "../components/RosterCalendar";
import { RosterPatternManager } from "../components/RosterPatternManager";
import { RosterWorkerLookup } from "../components/RosterWorkerLookup";
import "../styles/roster.css";

function buildMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

function todayMonthValue() {
  return toMonthInputValue(toTodayDateValue());
}

function maxProjectionMonthValue() {
  return toMonthInputValue(addMonthsToDateValue(toTodayDateValue(), 6));
}

function formatMonthCaption(monthValue: string) {
  const [year, month] = monthValue.split("-");
  if (!year || !month) {
    return monthValue;
  }

  return `${month}/${year}`;
}

function resolveSelectedDay(days: WorkerScheduleDay[], selectedDate: string) {
  return days.find((day) => day.date === selectedDate) ?? null;
}

function getExceptionSourceLabel(source: RosterExceptionSource | null) {
  return source === "buk"
    ? "BUK"
    : source === "incentive_auto"
      ? "Incentivo"
      : source === "manual"
        ? "Manual"
        : "";
}

export function RosterPage() {
  const { accessibleFeatures, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isPatternsView = location.pathname.endsWith("/patterns");
  const canViewCalendar =
    isSuperAdmin || hasFeatureAccess(accessibleFeatures, "roster_calendar");
  const canAssignPattern =
    isSuperAdmin || hasFeatureAccess(accessibleFeatures, "roster_assign_pattern");
  const canManagePatterns =
    isSuperAdmin || hasFeatureAccess(accessibleFeatures, "roster_manage_patterns");
  const [selectedWorker, setSelectedWorker] = useState<RosterWorkerSearchItem | null>(null);
  const [workerSearchTerm, setWorkerSearchTerm] = useState("");
  const [monthValue, setMonthValue] = useState(todayMonthValue());
  const [operationalAreaFilter, setOperationalAreaFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState(toTodayDateValue());
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState(toTodayDateValue());
  const [exceptionType, setExceptionType] = useState("");
  const [exceptionNotes, setExceptionNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const rosterProjectionMaxMonth = maxProjectionMonthValue();

  const setupCatalogsQuery = useRosterSetupCatalogs(canViewCalendar || canManagePatterns);
  const rosterCalendarSummaryQuery = useRosterCalendarSummary({
    monthValue,
    search: workerSearchTerm,
    areaFilter: operationalAreaFilter,
    enabled: !isPatternsView
  });
  const operationalAreaOptions = setupCatalogsQuery.data?.operationalAreas ?? [];
  const monthRange = useMemo(() => buildMonthRange(monthValue), [monthValue]);
  const workerScheduleQuery = useWorkerSchedule({
    bukEmployeeId: selectedWorker?.bukEmployeeId ?? "",
    startDate: monthRange.startDate,
    endDate: monthRange.endDate,
    enabled: Boolean(selectedWorker) && !isPatternsView
  });
  const selectedDay = useMemo(
    () => resolveSelectedDay(workerScheduleQuery.data?.days ?? [], selectedDate),
    [selectedDate, workerScheduleQuery.data?.days]
  );
  const exceptionOnFormDate = useMemo(
    () =>
      (workerScheduleQuery.data?.exceptions ?? []).find(
        (exception) => exception.exceptionDate === exceptionDate
      ) ?? null,
    [exceptionDate, workerScheduleQuery.data?.exceptions]
  );

  const refreshRoster = useCallback(async () => {
    await invalidateRosterQueries(queryClient);
    if (selectedWorker) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.roster.workerSchedule({
          bukEmployeeId: selectedWorker.bukEmployeeId,
          startDate: monthRange.startDate,
          endDate: monthRange.endDate
        })
      });
    }
  }, [monthRange.endDate, monthRange.startDate, queryClient, selectedWorker]);

  useRealtimeQueryInvalidation({
    channelName: `roster:${isPatternsView ? "patterns" : selectedWorker?.bukEmployeeId ?? "calendar"}`,
    invalidate: refreshRoster,
    subscriptions: [
      { table: "hr_shift_patterns" },
      { table: "hr_worker_rosters" },
      { table: "hr_roster_exceptions" }
    ]
  });

  const assignMutation = useMutation({
    mutationFn: assignWorkerRoster,
    onSuccess: async () => {
      setIsAssignmentOpen(false);
      setErrorMessage("");
      setStatusMessage("Pauta asignada correctamente.");
      await refreshRoster();
    },
    onError: (error: Error) => {
      setStatusMessage("");
      setErrorMessage(error.message);
    }
  });

  const exceptionMutation = useMutation({
    mutationFn: upsertRosterException,
    onSuccess: async () => {
      setExceptionType("");
      setExceptionNotes("");
      setStatusMessage("Excepción guardada correctamente.");
      setErrorMessage("");
      await refreshRoster();
    },
    onError: (error: Error) => {
      setStatusMessage("");
      setErrorMessage(error.message);
    }
  });

  const toggleExceptionMutation = useMutation({
    mutationFn: ({ exceptionId, isActive }: { exceptionId: string; isActive: boolean }) =>
      setRosterExceptionStatus(exceptionId, isActive),
    onSuccess: async () => {
      setErrorMessage("");
      setStatusMessage("Estado de excepción actualizado.");
      await refreshRoster();
    },
    onError: (error: Error) => {
      setStatusMessage("");
      setErrorMessage(error.message);
    }
  });

  if (!canViewCalendar && !canManagePatterns) {
    return <Navigate to="/sin-acceso" replace />;
  }

  if (isPatternsView && !canManagePatterns) {
    return <Navigate to="/roster" replace />;
  }

  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Jornadas y Turnos</h1>
      </div>

      <section className="tracking-panel roster-module-shell">
        <div className="approval-chip-row">
          {canViewCalendar ? (
            <button
              type="button"
              className={`approval-chip ${!isPatternsView ? "tracking-kpi-card-active" : ""}`}
              onClick={() => navigate("/roster")}
            >
              Calendario
            </button>
          ) : null}
          {canManagePatterns ? (
            <button
              type="button"
              className={`approval-chip ${isPatternsView ? "tracking-kpi-card-active" : ""}`}
              onClick={() => navigate("/roster/patterns")}
            >
              Gestor de pautas
            </button>
          ) : null}
        </div>

        {isPatternsView ? (
          setupCatalogsQuery.data ? <RosterPatternManager setupCatalogs={setupCatalogsQuery.data} /> : null
        ) : (
          <>
            <section className="info-card">
              <div className="tracking-toolbar">
                <div className="tracking-toolbar-copy">
                  <h3>Calendario por trabajador</h3>
                </div>
                <button
                  type="button"
                  className="soft-primary-button"
                  onClick={() => setIsAssignmentOpen(true)}
                  disabled={
                    !canAssignPattern ||
                    !selectedWorker ||
                    assignMutation.isPending ||
                    !setupCatalogsQuery.data
                  }
                >
                  Asignar pauta
                </button>
              </div>

              <div className="roster-toolbar-grid">
                <RosterWorkerLookup
                  id="roster-worker"
                  label="Trabajador"
                  placeholder="Busca por nombre, RUT, contrato o cargo"
                  selectedWorker={selectedWorker}
                  onSearchChange={setWorkerSearchTerm}
                  onSelect={(worker) => {
                    setSelectedWorker(worker);
                    setStatusMessage("");
                    setErrorMessage("");
                  }}
                />

                <div className="field-group roster-filter-month">
                  <label className="field-label" htmlFor="roster-month">
                    Mes
                  </label>
                  <input
                    id="roster-month"
                    className="text-field"
                    type="month"
                    value={monthValue}
                    max={rosterProjectionMaxMonth}
                    onChange={(event) => {
                      const nextMonth = event.target.value;
                      setMonthValue(nextMonth);
                      setSelectedDate(`${nextMonth}-01`);
                    }}
                  />
                </div>

                <SelectField
                  id="roster-operational-area"
                  label="Contrato / Área"
                  value={operationalAreaFilter}
                  onChange={(event) => setOperationalAreaFilter(event.target.value)}
                  options={operationalAreaOptions}
                  placeholder="Todos los contratos / áreas"
                  className="roster-filter-area"
                />
              </div>

              {statusMessage ? <p className="form-status form-status-success">{statusMessage}</p> : null}
              {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}
            </section>

            <div className="tracking-kpi-row roster-kpi-row">
              <article className="tracking-kpi-card tracking-kpi-card-generado">
                <span>Personas con jornada asignada</span>
                <strong>
                  {rosterCalendarSummaryQuery.isLoading
                    ? "..."
                    : rosterCalendarSummaryQuery.data?.assignedCount ?? 0}
                </strong>
              </article>
              <article className="tracking-kpi-card tracking-kpi-card-pendiente">
                <span>Personas pendientes</span>
                <strong>
                  {rosterCalendarSummaryQuery.isLoading
                    ? "..."
                    : rosterCalendarSummaryQuery.data?.pendingCount ?? 0}
                </strong>
              </article>
            </div>

            {rosterCalendarSummaryQuery.error ? (
              <section className="info-card">
                <p className="form-status form-status-error">
                  {rosterCalendarSummaryQuery.error.message}
                </p>
              </section>
            ) : null}

            {selectedWorker && workerScheduleQuery.data ? (
              <div className="tracking-kpi-row roster-kpi-row">
                <article className="tracking-kpi-card tracking-kpi-card-generado">
                  <span>Días trabajo</span>
                  <strong>{workerScheduleQuery.data.summary.workingDays}</strong>
                </article>
                <article className="tracking-kpi-card tracking-kpi-card-pendiente">
                  <span>Días descanso</span>
                  <strong>{workerScheduleQuery.data.summary.restingDays}</strong>
                </article>
                <article className="tracking-kpi-card tracking-kpi-card-en-proceso">
                  <span>Excepciones</span>
                  <strong>{workerScheduleQuery.data.summary.exceptionDays}</strong>
                </article>
                <article className="tracking-kpi-card tracking-kpi-card-error">
                  <span>Días sin pauta</span>
                  <strong>{workerScheduleQuery.data.summary.unassignedDays}</strong>
                </article>
              </div>
            ) : null}

            {workerScheduleQuery.isLoading ? (
              <section className="info-card">
                <p className="tracking-filter-caption">Cargando calendario operativo...</p>
              </section>
            ) : null}

            {workerScheduleQuery.error ? (
              <section className="info-card">
                <p className="form-status form-status-error">{workerScheduleQuery.error.message}</p>
              </section>
            ) : null}

            {!selectedWorker ? (
              <section className="info-card">
                <p className="tracking-filter-caption">
                  Selecciona un trabajador para cargar su calendario de jornadas y excepciones.
                </p>
              </section>
            ) : null}

            {selectedWorker && workerScheduleQuery.data ? (
              <div className="roster-content-grid">
                <RosterCalendar
                  monthValue={monthValue}
                  days={workerScheduleQuery.data.days}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />

                <section className="roster-side-panel">
                  <section className="info-card">
                    <div className="tracking-toolbar-copy">
                      <h3>{formatPersonLabel(workerScheduleQuery.data.worker.fullName)}</h3>
                      <span className="tracking-filter-caption">
                        {formatRequestDate(selectedDate)} ·{" "}
                        {selectedDay?.exceptionLabel ??
                          (selectedDay?.baseStatus === "working"
                            ? "Trabajo"
                            : selectedDay?.baseStatus === "resting"
                              ? "Descanso"
                              : "Sin pauta")}
                      </span>
                    </div>

                    {selectedDay ? (
                      <div className="roster-day-detail">
                        <div className="roster-day-detail-row">
                          <span>Pauta</span>
                          <strong>{selectedDay.patternName ?? "Sin asignación"}</strong>
                        </div>

                        <div className="roster-day-detail-row">
                          <span>Estado Actual</span>
                          <strong>
                            {selectedDay.exceptionLabel ?? 
                              (selectedDay.effectiveStatus === "working" ? "En turno" :
                               selectedDay.effectiveStatus === "resting" ? "Descanso" :
                               selectedDay.effectiveStatus === "absent" ? "Ausente" :
                               selectedDay.effectiveStatus === "extra_shift" ? "Turno extra" :
                               selectedDay.effectiveStatus === "vacation" ? "Vacación" :
                               selectedDay.effectiveStatus === "training" ? "Capacitación" : "Sin pauta")}
                          </strong>
                        </div>
                        <div className="roster-day-detail-row">
                          <span>Día del ciclo</span>
                          <strong>{selectedDay.cycleDay ?? "—"}</strong>
                        </div>
                        {selectedDay.exceptionNotes ? (
                          <div className="roster-day-detail-notes">
                            <span>Observación</span>
                            <p>{selectedDay.exceptionNotes}</p>
                          </div>
                        ) : null}
                        {selectedDay.exceptionSource ? (
                          <div className="roster-day-detail-notes">
                            <span>Origen</span>
                            <p>{getExceptionSourceLabel(selectedDay.exceptionSource)}</p>
                          </div>
                        ) : null}
                        
                        <div style={{ marginTop: "1rem", padding: "0.6rem 0.75rem", backgroundColor: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "6px", fontSize: "0.76rem", color: "rgb(180, 83, 9)", lineHeight: "1.4" }}>
                          <strong style={{ display: "block", marginBottom: "0.15rem", color: "rgb(146, 64, 14)", fontSize: "0.78rem" }}>Proyección de jornadas</strong>
                          La proyección automática se calcula como máximo hasta el mes de {formatMonthCaption(rosterProjectionMaxMonth)}.
                        </div>
                      </div>
                    ) : (
                      <p className="tracking-filter-caption">Selecciona un día para revisar su detalle.</p>
                    )}
                  </section>

                  <section className="info-card">
                    <div className="tracking-toolbar-copy">
                      <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        Registrar excepción
                        <div className="roster-info-tooltip-container">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", cursor: "help" }}>
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 16v-4"></path>
                            <path d="M12 8h.01"></path>
                          </svg>
                          <div className="roster-info-tooltip">
                            Vacaciones, licencias, turnos extra y permisos que rompen la pauta base.
                            <br/><br/>
                            Las vacaciones y licencias cargadas por BUK siguen siendo visibles aquí, pero no pueden modificarse manualmente y siempre tienen prioridad.
                          </div>
                        </div>
                      </h3>
                    </div>

                    <div className="roster-form-grid">
                      <DatePickerField
                        id="roster-exception-date"
                        label="Fecha"
                        value={exceptionDate}
                        onChange={setExceptionDate}
                        minValue="2025-01-01"
                        maxValue=""
                      />
                      <SelectField
                        id="roster-exception-type"
                        label="Tipo"
                        value={exceptionType}
                        onChange={(event) => setExceptionType(event.target.value)}
                        options={setupCatalogsQuery.data?.exceptionTypes ?? []}
                        placeholder="Selecciona una excepción"
                      />
                      <TextField
                        id="roster-exception-notes"
                        label="Notas"
                        value={exceptionNotes}
                        onChange={(event) => setExceptionNotes(event.target.value)}
                        placeholder="Contexto operativo"
                      />
                    </div>

                    <div className="action-row">
                      <button
                        type="button"
                        className="soft-primary-button soft-primary-button-success"
                        disabled={
                          !canAssignPattern ||
                          exceptionMutation.isPending ||
                              !selectedWorker ||
                              !exceptionDate ||
                              !exceptionType ||
                              exceptionOnFormDate?.exceptionSource === "buk" ||
                              exceptionOnFormDate?.exceptionSource === "incentive_auto"
                        }
                        onClick={() =>
                          exceptionMutation.mutate({
                            bukEmployeeId: selectedWorker.bukEmployeeId,
                            exceptionDate,
                            exceptionType: exceptionType as RosterExceptionType,
                            notes: exceptionNotes.trim() || null
                          })
                        }
                      >
                        {exceptionMutation.isPending ? "Guardando..." : "Guardar excepción"}
                      </button>
                    </div>
                    {exceptionOnFormDate?.exceptionSource === "buk" ? (
                      <p className="form-status form-status-error">
                        La fecha {formatRequestDate(exceptionOnFormDate.exceptionDate)} está gobernada por BUK y no puede reemplazarse manualmente.
                      </p>
                    ) : null}
                    {exceptionOnFormDate?.exceptionSource === "incentive_auto" ? (
                      <p className="form-status form-status-error">
                        La fecha {formatRequestDate(exceptionOnFormDate.exceptionDate)} fue marcada automáticamente por Incentivos y no puede reemplazarse manualmente desde Jornadas.
                      </p>
                    ) : null}
                  </section>

                  <section className="info-card">
                    <div className="tracking-toolbar-copy">
                      <h3>Excepciones del mes</h3>
                    </div>

                    <div className="roster-list">
                      {(workerScheduleQuery.data.exceptions ?? []).length === 0 ? (
                        <p className="tracking-filter-caption">No hay excepciones activas en este período.</p>
                      ) : null}

                      {(workerScheduleQuery.data.exceptions ?? []).map((exception) => (
                        <div key={exception.id} className="roster-list-item">
                          <div>
                            <strong>{exception.exceptionLabel}</strong>
                            <span>
                              {formatRequestDate(exception.exceptionDate)} ·{" "}
                              {getDaysSince(exception.exceptionDate) === 0 ? "Hoy" : `${getDaysSince(exception.exceptionDate) ?? 0} días`}
                            </span>
                            <span>{`Origen: ${getExceptionSourceLabel(exception.exceptionSource)}`}</span>
                            {exception.notes ? <small>{exception.notes}</small> : null}
                          </div>
                          <button
                            type="button"
                            className={
                              exception.exceptionSource === "buk"
                                || exception.exceptionSource === "incentive_auto"
                                ? "roster-inline-button roster-inline-button--disabled"
                                : `roster-inline-button ${exception.isActive ? "roster-inline-button--deactivate" : "roster-inline-button--activate"}`
                            }
                            disabled={
                              !canAssignPattern ||
                              toggleExceptionMutation.isPending ||
                              exception.exceptionSource === "buk" ||
                              exception.exceptionSource === "incentive_auto"
                            }
                            onClick={() =>
                              toggleExceptionMutation.mutate({
                                exceptionId: exception.id,
                                isActive: !exception.isActive
                              })
                            }
                          >
                            {exception.exceptionSource === "buk"
                              ? "Gobernado por BUK"
                              : exception.exceptionSource === "incentive_auto"
                                ? "Gobernado por Incentivos"
                              : exception.isActive
                                ? "Desactivar"
                                : "Activar"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                </section>
              </div>
            ) : null}
          </>
        )}
      </section>

      <RosterAssignmentDialog
        isOpen={isAssignmentOpen}
        worker={selectedWorker}
        patterns={setupCatalogsQuery.data?.patterns ?? []}
        assignments={workerScheduleQuery.data?.assignments ?? []}
        isSubmitting={assignMutation.isPending || !canAssignPattern}
        onClose={() => setIsAssignmentOpen(false)}
        onConfirm={async (payload) => {
          if (!selectedWorker || !canAssignPattern) {
            return;
          }

          await assignMutation.mutateAsync({
            bukEmployeeId: selectedWorker.bukEmployeeId,
            patternId: payload.patternId,
            startDate: payload.startDate,
            endDate: payload.endDate || null,
            notes: payload.notes || null
          });
        }}
      />
    </PageShell>
  );
}
