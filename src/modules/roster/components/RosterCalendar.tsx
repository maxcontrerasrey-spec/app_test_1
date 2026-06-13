import { buildCalendarDays, formatDateValue, parseDateValue } from "../../../shared/lib/date";
import { formatRequestDate } from "../../../shared/lib/format";
import type { WorkerScheduleDay } from "../types";

type RosterCalendarProps = {
  monthValue: string;
  days: WorkerScheduleDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

function getDayTone(day: WorkerScheduleDay | null, inMonth: boolean) {
  if (!inMonth || !day) {
    return "roster-calendar-day--muted";
  }

  if (day.exceptionType === "vacation" || day.exceptionType === "medical_leave") {
    return "roster-calendar-day--vacation";
  }

  if (day.exceptionType === "absent" || day.exceptionType === "administrative_leave") {
    return "roster-calendar-day--absent";
  }

  if (day.exceptionType === "extra_shift") {
    return "roster-calendar-day--extra";
  }

  if (day.exceptionType === "training" || day.exceptionType === "union_leave") {
    return "roster-calendar-day--training";
  }

  if (day.baseStatus === "working") {
    return "roster-calendar-day--working";
  }

  if (day.baseStatus === "resting") {
    return "roster-calendar-day--resting";
  }

  return "roster-calendar-day--unassigned";
}

function getDayLabel(day: WorkerScheduleDay | null) {
  if (!day) {
    return "Sin pauta";
  }

  if (day.exceptionLabel) {
    return day.exceptionLabel;
  }

  switch (day.baseStatus) {
    case "working":
      return "Trabajo";
    case "resting":
      return "Descanso";
    default:
      return "Sin pauta";
  }
}

export function RosterCalendar({
  monthValue,
  days,
  selectedDate,
  onSelectDate
}: RosterCalendarProps) {
  const viewDate = parseDateValue(`${monthValue}-01`);
  const calendarDays = buildCalendarDays(viewDate);
  const daysByDate = new Map(days.map((day) => [day.date, day]));

  return (
    <section className="info-card roster-calendar-card">
      <div className="tracking-toolbar-copy">
        <h3>Calendario operativo</h3>
        <span className="tracking-filter-caption">
          La pauta matemática se calcula por ciclo y las excepciones rompen la regla base.
        </span>
      </div>

      <div className="roster-calendar-legend">
        <span><i className="roster-calendar-dot roster-calendar-dot--working" />Trabajo</span>
        <span><i className="roster-calendar-dot roster-calendar-dot--resting" />Descanso</span>
        <span><i className="roster-calendar-dot roster-calendar-dot--vacation" />Vacación / licencia</span>
        <span><i className="roster-calendar-dot roster-calendar-dot--extra" />Turno extra</span>
      </div>

      <div className="calendar-weekdays roster-calendar-weekdays">
        {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="calendar-grid roster-calendar-grid">
        {calendarDays.map((calendarDay) => {
          const dayValue = formatDateValue(calendarDay.value);
          const scheduleDay = daysByDate.get(dayValue) ?? null;
          const isSelected = dayValue === selectedDate;

          return (
            <button
              key={calendarDay.key}
              type="button"
              className={[
                "roster-calendar-day",
                getDayTone(scheduleDay, calendarDay.inMonth),
                isSelected ? "roster-calendar-day--selected" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDate(dayValue)}
              title={scheduleDay ? `${formatRequestDate(dayValue)} · ${getDayLabel(scheduleDay)}` : formatRequestDate(dayValue)}
            >
              <strong>{calendarDay.value.getDate()}</strong>
              <span>{getDayLabel(scheduleDay)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
