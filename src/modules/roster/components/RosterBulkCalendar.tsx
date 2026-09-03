import { parseDateValue, formatDateValue } from "../../../shared/lib/date";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { RosterBulkWorker, WorkerScheduleDay } from "../types";

type Props = { startDate: string; endDate: string; workers: RosterBulkWorker[]; isLoading?: boolean };
const NO_PATTERN_FILTER = "__no_pattern__";

function tone(day: WorkerScheduleDay | undefined) {
  if (!day || day.baseStatus === "unassigned") return "roster-bulk-cell--unassigned";
  if (day.exceptionType === "vacation") return "roster-bulk-cell--vacation";
  if (day.exceptionType === "medical_leave") return "roster-bulk-cell--medical-leave";
  if (day.exceptionType === "termination") return "roster-bulk-cell--termination";
  if (day.exceptionType === "absent" || day.exceptionType === "administrative_leave") return "roster-bulk-cell--absent";
  if (day.exceptionType === "extra_shift") return "roster-bulk-cell--extra";
  if (day.exceptionType === "training" || day.exceptionType === "union_leave") return "roster-bulk-cell--training";
  return day.baseStatus === "working" ? "roster-bulk-cell--working" : "roster-bulk-cell--resting";
}

function label(day: WorkerScheduleDay | undefined) {
  if (!day) return "—";
  if (day.exceptionLabel) return day.exceptionLabel.slice(0, 3).toUpperCase();
  return day.baseStatus === "working" ? "T" : day.baseStatus === "resting" ? "D" : "—";
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

async function exportRosterCalendar(
  workers: RosterBulkWorker[],
  dates: Array<{ value: string }>,
  selectedPattern: string
) {
  const { utils, writeFile } = await import("@mylinkpi/xlsx");
  const isNoPatternExport = selectedPattern === NO_PATTERN_FILTER;
  const rows = isNoPatternExport
    ? workers.map((worker) => ({
        Nombre: worker.fullName,
        RUT: worker.documentNumber,
        Cargo: worker.jobTitle,
        Contrato: worker.contractCode ?? "—"
      }))
    : workers.flatMap((worker) => {
        const days = new Map(worker.days.map((day) => [day.date, day]));
        return dates.map((date) => {
          const day = days.get(date.value);
          return {
            Nombre: worker.fullName,
            RUT: worker.documentNumber,
            Cargo: worker.jobTitle,
            Contrato: worker.contractCode ?? "—",
            Jornada: day?.patternName ?? "Sin jornada",
            Fecha: formatExportDate(date.value),
            Estatus: day ? resolveDayStatus(day) : "Sin jornada"
          };
        });
      });

  if (rows.length === 0) return;
  const worksheet = utils.json_to_sheet(rows);
  worksheet["!cols"] = isNoPatternExport
    ? [{ wch: 32 }, { wch: 16 }, { wch: 34 }, { wch: 28 }]
    : [{ wch: 32 }, { wch: 16 }, { wch: 34 }, { wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 24 }];
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Calendario");
  const suffix = selectedPattern === NO_PATTERN_FILTER ? "sin-jornada" : "sabana-calendario";
  writeFile(workbook, `${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function RosterBulkCalendar({ startDate, endDate, workers, isLoading = false }: Props) {
  const [selectedPattern, setSelectedPattern] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const patternOptions = useMemo(() => {
    const workerCounts = new Map<string, number>();
    workers.forEach((worker) => {
      const workerPatterns = new Set(
        worker.days
          .map((day) => day.patternName)
          .filter((pattern): pattern is string => Boolean(pattern))
      );
      if (workerPatterns.size === 0) {
        workerCounts.set(NO_PATTERN_FILTER, (workerCounts.get(NO_PATTERN_FILTER) ?? 0) + 1);
      } else {
        workerPatterns.forEach((pattern) => workerCounts.set(pattern, (workerCounts.get(pattern) ?? 0) + 1));
      }
    });
    return [...workerCounts.entries()].sort(([left], [right]) => {
      if (left === NO_PATTERN_FILTER) return 1;
      if (right === NO_PATTERN_FILTER) return -1;
      return left.localeCompare(right, "es");
    });
  }, [workers]);
  const visibleWorkers = useMemo(
    () =>
      selectedPattern
        ? workers.filter((worker) =>
            selectedPattern === NO_PATTERN_FILTER
              ? worker.days.every((day) => !day.patternName)
              : worker.days.some((day) => day.patternName === selectedPattern)
          )
        : workers,
    [selectedPattern, workers]
  );
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);
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
    if (visibleWorkers.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      await exportRosterCalendar(visibleWorkers, dates, selectedPattern);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="info-card roster-bulk-card" aria-label="Calendario de trabajadores">
      <div className="roster-bulk-header">
        <div className="tracking-toolbar-copy">
          <h3>Calendario general</h3>
          <span className="tracking-filter-caption">{visibleWorkers.length} trabajadores · desplázate para revisar la nómina completa</span>
        </div>
        <div className="roster-bulk-header-actions">
          {patternOptions.length > 0 ? (
            <div className="roster-bulk-pattern-filters" aria-label="Filtrar por jornada">
              <span className="roster-bulk-pattern-label">Jornadas</span>
              <div className="roster-bulk-pattern-chips">
                <button
                  type="button"
                  className={`approval-chip ${selectedPattern === "" ? "tracking-kpi-card-active" : ""}`}
                  onClick={() => setSelectedPattern("")}
                >
                  Todas <span>{workers.length}</span>
                </button>
                {patternOptions.map(([pattern, workerCount]) => {
                  const patternLabel = pattern === NO_PATTERN_FILTER ? "Sin Jornada" : pattern;
                  return (
                    <button
                      type="button"
                      className={`approval-chip ${selectedPattern === pattern ? "tracking-kpi-card-active" : ""}`}
                      key={pattern}
                      onClick={() => setSelectedPattern(pattern)}
                      title={`Mostrar trabajadores ${patternLabel.toLowerCase()}`}
                    >
                      {patternLabel} <span>{workerCount}</span>
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
            disabled={isLoading || isExporting || visibleWorkers.length === 0}
            title="Exportar los trabajadores y fechas actualmente visibles"
          >
            {isExporting ? "Preparando..." : "Exportar Excel"}
          </button>
        </div>
      </div>
      {isLoading ? <p className="tracking-filter-caption">Cargando calendario...</p> : null}
      {!isLoading && visibleWorkers.length === 0 ? <p className="tracking-filter-caption">No hay trabajadores para los filtros seleccionados.</p> : null}
      {visibleWorkers.length > 0 ? (
        <div className="roster-bulk-scroll">
          <div className="roster-bulk-grid" style={{ "--roster-day-count": totalDays } as CSSProperties}>
            <div className="roster-bulk-worker-header">Trabajador</div>
            {dates.map((date) => <div className="roster-bulk-date" key={date.value}><small>{date.month}</small><span>{date.weekday}</span><strong>{date.day}</strong></div>)}
            {visibleWorkers.map((worker) => {
              const days = new Map(worker.days.map((day) => [day.date, day]));
              const jornadaLabel = resolveWorkerPatternLabel(worker.days);
              return <div className="roster-bulk-row" key={worker.bukEmployeeId}>
                <div className="roster-bulk-worker"><strong>{worker.fullName}</strong><span title={jornadaLabel}>{worker.documentNumber} · {jornadaLabel}</span></div>
                {dates.map((date) => { const day = days.get(date.value); return <div className={`roster-bulk-cell ${tone(day)}`} key={date.value} title={`${worker.fullName} · ${date.value} · ${day?.exceptionLabel ?? (day?.baseStatus === "working" ? "Trabajo" : day?.baseStatus === "resting" ? "Descanso" : "Sin pauta")}`}><strong>{label(day)}</strong></div>; })}
              </div>;
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
