import { parseDateValue, formatDateValue } from "../../../shared/lib/date";
import type { CSSProperties } from "react";
import type { RosterBulkWorker, WorkerScheduleDay } from "../types";

type Props = { monthValue: string; workers: RosterBulkWorker[]; isLoading?: boolean };

function tone(day: WorkerScheduleDay | undefined) {
  if (!day || day.baseStatus === "unassigned") return "roster-bulk-cell--unassigned";
  if (day.exceptionType === "vacation" || day.exceptionType === "medical_leave") return "roster-bulk-cell--leave";
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

export function RosterBulkCalendar({ monthValue, workers, isLoading = false }: Props) {
  const view = parseDateValue(`${monthValue}-01`);
  const totalDays = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const dates = Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(view.getFullYear(), view.getMonth(), index + 1);
    return { value: formatDateValue(date), day: date.getDate(), weekday: new Intl.DateTimeFormat("es-CL", { weekday: "short" }).format(date).replace(".", "") };
  });

  return (
    <section className="info-card roster-bulk-card" aria-label="Calendario de trabajadores">
      <div className="tracking-toolbar-copy">
        <h3>Calendario general</h3>
        <span className="tracking-filter-caption">{workers.length} trabajadores · desplázate para revisar la nómina completa</span>
      </div>
      {isLoading ? <p className="tracking-filter-caption">Cargando calendario...</p> : null}
      {!isLoading && workers.length === 0 ? <p className="tracking-filter-caption">No hay trabajadores para los filtros seleccionados.</p> : null}
      {workers.length > 0 ? (
        <div className="roster-bulk-scroll">
          <div className="roster-bulk-grid" style={{ "--roster-day-count": totalDays } as CSSProperties}>
            <div className="roster-bulk-worker-header">Trabajador</div>
            {dates.map((date) => <div className="roster-bulk-date" key={date.value}><span>{date.weekday}</span><strong>{date.day}</strong></div>)}
            {workers.map((worker) => {
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
