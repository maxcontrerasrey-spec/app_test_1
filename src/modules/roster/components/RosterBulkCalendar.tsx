import { parseDateValue, formatDateValue, toTodayDateValue } from "../../../shared/lib/date";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type {
  RosterBulkCalendarPayload,
  RosterBulkWorker,
  RosterCalendarCycleCount,
  ShiftPattern,
  WorkerScheduleDay
} from "../types";

type Props = {
  startDate: string;
  endDate: string;
  workers: RosterBulkWorker[];
  patterns: ShiftPattern[];
  cycleCounts: RosterCalendarCycleCount[];
  totalWorkers: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor: { fullName: string; bukEmployeeId: string } | null;
  selectedPattern: string;
  onSelectedPatternChange: (pattern: string) => void;
  onPageChange: (page: number, cursor?: { fullName: string; bukEmployeeId: string }) => void;
  onLoadAllWorkersForExport: (signal: AbortSignal, cycleFilter: string) => Promise<RosterBulkCalendarPayload>;
  isLoading?: boolean;
};
export const ROSTER_NO_PATTERN_FILTER = "__no_pattern__";
const SHIFT_CYCLE_PATTERN = /\b\d+\s*[xX]\s*\d+(?:\s*\+\s*\d+)?\b/;

export function resolvePatternCycle(patternName: string | null | undefined) {
  const match = patternName?.match(SHIFT_CYCLE_PATTERN)?.[0];
  return match ? match.replace(/\s+/g, "").toUpperCase() : patternName ?? "";
}

function getPatternShiftLabel(day: WorkerScheduleDay | undefined, patternsById: Map<string, ShiftPattern>) {
  if (!day || !day.cycleDay || !day.patternId) return null;
  return patternsById.get(day.patternId)?.workdayLabels?.[day.cycleDay - 1] ?? null;
}

function tone(day: WorkerScheduleDay | undefined, patternsById: Map<string, ShiftPattern>) {
  if (!day || day.baseStatus === "unassigned") return "roster-bulk-cell--unassigned";
  if (day.exceptionType === "vacation") return "roster-bulk-cell--vacation";
  if (day.exceptionType === "medical_leave") return "roster-bulk-cell--medical-leave";
  if (day.exceptionType === "termination") return "roster-bulk-cell--termination";
  if (day.exceptionType === "absent" || day.exceptionType === "administrative_leave") return "roster-bulk-cell--absent";
  if (day.exceptionType === "extra_shift") return "roster-bulk-cell--extra";
  if (day.exceptionType === "training" || day.exceptionType === "union_leave") return "roster-bulk-cell--training";
  return getPatternShiftLabel(day, patternsById) || day.baseStatus === "working"
    ? "roster-bulk-cell--working"
    : "roster-bulk-cell--resting";
}

function label(day: WorkerScheduleDay | undefined, patternsById: Map<string, ShiftPattern>) {
  if (!day) return "—";
  if (day.exceptionLabel) return day.exceptionLabel.slice(0, 3).toUpperCase();
  const shiftLabel = getPatternShiftLabel(day, patternsById);
  if (shiftLabel) return shiftLabel;
  if (day.baseStatus === "working") return "T";
  return day.baseStatus === "resting" ? "D" : "—";
}

function resolveWorkerPatternLabel(days: WorkerScheduleDay[]) {
  const patternNames = [...new Set(days.map((day) => day.patternName).filter(Boolean))];
  return patternNames.length > 0 ? patternNames.join(" / ") : "Sin jornada";
}

function resolveDayStatus(day: WorkerScheduleDay) {
  if (day.exceptionLabel) return day.exceptionLabel;
  if (day.exceptionType === "medical_leave") return "Licencia médica";
  if (day.exceptionType === "vacation") return "Vacaciones";
  if (day.exceptionType === "termination") return "Salida";
  if (day.exceptionType === "absent") return "Ausencia";
  if (day.exceptionType === "administrative_leave") return "Permiso administrativo";
  if (day.exceptionType === "extra_shift") return "Turno extra";
  if (day.exceptionType === "training") return "Capacitación";
  if (day.exceptionType === "union_leave") return "Permiso sindical";
  if (day.baseStatus === "working") return "Trabajando";
  if (day.baseStatus === "resting") return "Descanso";
  return "Sin jornada";
}

function formatExportDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-");
  return year && month && day ? `${day}-${month}-${year}` : dateValue;
}

export function resolveRosterExportContractLabel(worker: Pick<RosterBulkWorker, "areaName" | "contractCode">) {
  return worker.areaName?.trim() || worker.contractCode?.trim() || "—";
}

export function filterRosterWorkersByCycle<T extends Pick<RosterBulkWorker, "days">>(workers: T[], selectedPattern: string) {
  if (!selectedPattern) return workers;
  return workers.filter((worker) =>
    selectedPattern === ROSTER_NO_PATTERN_FILTER
      ? worker.days.every((day) => !day.patternName)
      : worker.days.some((day) => resolvePatternCycle(day.patternName) === selectedPattern)
  );
}

async function exportRosterCalendar(
  workers: RosterBulkWorker[],
  dates: Array<{ value: string }>,
  selectedPattern: string
) {
  const { utils, writeFile } = await import("@mylinkpi/xlsx");
  const isNoPatternExport = selectedPattern === ROSTER_NO_PATTERN_FILTER;
  const rows = isNoPatternExport
    ? workers.map((worker) => ({
        Nombre: worker.fullName,
        RUT: worker.documentNumber,
        Cargo: worker.jobTitle,
        Contrato: resolveRosterExportContractLabel(worker),
        "Código contrato": worker.contractCode ?? "—"
      }))
    : workers.flatMap((worker) => {
        const days = new Map(worker.days.map((day) => [day.date, day]));
        return dates.map((date) => {
          const day = days.get(date.value);
          return {
            Nombre: worker.fullName,
            RUT: worker.documentNumber,
            Cargo: worker.jobTitle,
            Contrato: resolveRosterExportContractLabel(worker),
            "Código contrato": worker.contractCode ?? "—",
            Jornada: day?.patternName ?? "Sin jornada",
            Fecha: formatExportDate(date.value),
            Estatus: day ? resolveDayStatus(day) : "Sin jornada"
          };
        });
      });

  if (rows.length === 0) return;
  const worksheet = utils.json_to_sheet(rows);
  worksheet["!cols"] = isNoPatternExport
    ? [{ wch: 32 }, { wch: 16 }, { wch: 34 }, { wch: 34 }, { wch: 18 }]
    : [{ wch: 32 }, { wch: 16 }, { wch: 34 }, { wch: 34 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 24 }];
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Calendario");
  const suffix = selectedPattern === ROSTER_NO_PATTERN_FILTER ? "sin-jornada" : "sabana-calendario";
  writeFile(workbook, `${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function RosterBulkCalendar({
  startDate,
  endDate,
  workers,
  patterns,
  cycleCounts,
  totalWorkers,
  page,
  pageSize,
  hasMore,
  nextCursor,
  selectedPattern,
  onSelectedPatternChange,
  onPageChange,
  onLoadAllWorkersForExport,
  isLoading = false
}: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportAbortRef = useRef<AbortController | null>(null);
  const patternsById = useMemo(() => new Map(patterns.map((pattern) => [pattern.id, pattern])), [patterns]);
  const patternOptions = useMemo(
    () => [...cycleCounts].sort((left, right) => {
      if (left.cycle === ROSTER_NO_PATTERN_FILTER) return 1;
      if (right.cycle === ROSTER_NO_PATTERN_FILTER) return -1;
      return left.cycle.localeCompare(right.cycle, "es");
    }),
    [cycleCounts]
  );
  const selectedWorkerCount = selectedPattern
    ? patternOptions.find((item) => item.cycle === selectedPattern)?.count ?? 0
    : totalWorkers;
  const pageCount = Math.ceil(selectedWorkerCount / pageSize);
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);
  const todayValue = toTodayDateValue();
  const totalDays = Math.max(0, Math.floor((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1);
  const dates = Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      value: formatDateValue(date),
      day: date.getDate(),
      month: new Intl.DateTimeFormat("es-CL", { month: "short" }).format(date).replace(".", ""),
      weekday: new Intl.DateTimeFormat("es-CL", { weekday: "short" }).format(date).replace(".", "")
    };
  });

  const handleExport = async () => {
    if (selectedWorkerCount === 0 || isExporting || isLoading) return;
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setIsExporting(true);
    setExportError("");
    try {
      const completeCalendar = await onLoadAllWorkersForExport(controller.signal, selectedPattern);
      const exportWorkers = filterRosterWorkersByCycle(completeCalendar.workers, selectedPattern);
      await exportRosterCalendar(exportWorkers, dates, selectedPattern);
    } catch (error) {
      if (!controller.signal.aborted) {
        setExportError(error instanceof Error ? error.message : "No fue posible exportar el calendario.");
      }
    } finally {
      if (exportAbortRef.current === controller) exportAbortRef.current = null;
      setIsExporting(false);
    }
  };

  useEffect(() => () => exportAbortRef.current?.abort(), []);

  return (
    <section className="info-card roster-bulk-card" aria-label="Calendario de trabajadores">
      <div className="roster-bulk-header">
        <div className="tracking-toolbar-copy">
          <h3>Calendario general</h3>
          <span className="tracking-filter-caption">
            {selectedWorkerCount} trabajadores · {pageCount > 0 ? `página ${page} de ${pageCount}` : "sin páginas"}
          </span>
        </div>
        <div className="roster-bulk-header-actions">
          {patternOptions.length > 0 ? (
            <div className="roster-bulk-pattern-filters" aria-label="Filtrar por jornada">
              <span className="roster-bulk-pattern-label">Jornadas</span>
              <div className="roster-bulk-pattern-chips">
                <button
                  type="button"
                  className={`approval-chip ${selectedPattern === "" ? "tracking-kpi-card-active" : ""}`}
                  onClick={() => onSelectedPatternChange("")}
                  disabled={isLoading || selectedPattern === ""}
                >
                  Todas <span>{totalWorkers}</span>
                </button>
                {patternOptions.map(({ cycle, count }) => {
                  const patternLabel = cycle === ROSTER_NO_PATTERN_FILTER ? "Sin Jornada" : cycle;
                  return (
                    <button
                      type="button"
                      className={`approval-chip ${selectedPattern === cycle ? "tracking-kpi-card-active" : ""}`}
                      key={cycle}
                      onClick={() => onSelectedPatternChange(cycle)}
                      disabled={isLoading || selectedPattern === cycle}
                      title={`Mostrar trabajadores ${patternLabel.toLowerCase()}`}
                    >
                      {patternLabel} <span>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="soft-primary-button roster-bulk-export-button"
            onClick={handleExport}
            disabled={isLoading || isExporting || selectedWorkerCount === 0}
            title="Exportar todos los trabajadores y fechas de los filtros aplicados"
          >
            {isExporting ? "Preparando..." : "Exportar Excel"}
          </button>
        </div>
      </div>
      {isLoading ? <p className="tracking-filter-caption">Cargando calendario...</p> : null}
      {exportError ? <p className="form-status form-status-error" role="alert">{exportError}</p> : null}
      {!isLoading && selectedWorkerCount === 0 ? <p className="tracking-filter-caption">No hay trabajadores para los filtros seleccionados.</p> : null}
      {!isLoading && workers.length > 0 ? (
        <div className="roster-bulk-scroll">
          <div className="roster-bulk-grid" style={{ "--roster-day-count": totalDays } as CSSProperties}>
            <div className="roster-bulk-worker-header">Trabajador</div>
            {dates.map((date) => (
              <div
                className={`roster-bulk-date ${date.value === todayValue ? "roster-bulk-date--today" : ""}`}
                key={date.value}
                aria-label={date.value === todayValue ? `${date.weekday} ${date.day}, hoy` : `${date.weekday} ${date.day}`}
              >
                <small>{date.month}</small>
                <span>{date.weekday}</span>
                <strong>{date.day}</strong>
              </div>
            ))}
            {workers.map((worker) => {
              const days = new Map(worker.days.map((day) => [day.date, day]));
              const jornadaLabel = resolveWorkerPatternLabel(worker.days);
              return <div className="roster-bulk-row" key={worker.bukEmployeeId}>
                <div className="roster-bulk-worker" title={`${worker.fullName} · ${worker.documentNumber}`}>
                  <strong>{worker.fullName}</strong>
                  <span>
                    {worker.jobTitle}
                    <small title={jornadaLabel}> · {jornadaLabel}</small>
                  </span>
                </div>
                {dates.map((date) => {
                  const day = days.get(date.value);
                  const isToday = date.value === todayValue;
                  return (
                    <div
                      className={`roster-bulk-cell ${tone(day, patternsById)} ${isToday ? "roster-bulk-cell--today" : ""}`}
                      key={date.value}
                      title={`${worker.fullName} · ${date.value} · ${day?.exceptionLabel ?? (day?.baseStatus === "working" ? "Trabajo" : day?.baseStatus === "resting" ? "Descanso" : "Sin pauta")}`}
                    >
                      <strong>{label(day, patternsById)}</strong>
                    </div>
                  );
                })}
              </div>;
            })}
          </div>
        </div>
      ) : null}
      {!isLoading && (page > 1 || hasMore) ? (
        <nav className="roster-bulk-pagination" aria-label="Paginación del calendario">
          <button type="button" className="secondary-button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
            Anterior
          </button>
          <span className="tracking-filter-caption">Mostrando {workers.length} de {selectedWorkerCount}</span>
          <button type="button" className="secondary-button" onClick={() => nextCursor && onPageChange(page + 1, nextCursor)} disabled={!hasMore || !nextCursor}>
            Siguiente
          </button>
        </nav>
      ) : null}
    </section>
  );
}
