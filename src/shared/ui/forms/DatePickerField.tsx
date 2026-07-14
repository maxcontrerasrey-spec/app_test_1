import { useState, useRef, useEffect } from "react";
import {
  monthOptions,
  toTodayDateValue,
  formatDateForDisplay,
  parseDateValue,
  formatDateValue,
  buildCalendarDays
} from "../../lib/date";
import { SelectField } from "./SelectField";

type DatePickerFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (dateValue: string) => void;
  placeholder?: string;
  className?: string;
  minValue?: string;
  maxValue?: string;
};

export function DatePickerField({
  id,
  label,
  value,
  onChange,
  placeholder = "Seleccione la fecha",
  className = "",
  minValue,
  maxValue
}: DatePickerFieldProps) {
  const todayValue = toTodayDateValue();
  const effectiveMinValue = minValue ?? "";
  const effectiveMaxValue = maxValue ?? "";
  const currentYear = new Date().getFullYear();
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() =>
    value ? parseDateValue(value) : parseDateValue(todayValue)
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sincronizar viewDate si el value externo cambia
  useEffect(() => {
    if (value) {
      setViewDate(parseDateValue(value));
    }
  }, [value]);

  const selectedDate = value ? parseDateValue(value) : null;
  const calendarDays = buildCalendarDays(viewDate);
  const yearOptions = Array.from({ length: 9 }, (_, index) => currentYear - 1 + index);

  return (
    <div className={`field-group ${className}`.trim()} ref={containerRef}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="date-picker">
        <button
          type="button"
          id={id}
          className="text-field date-trigger"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span>{value ? formatDateForDisplay(value) : placeholder}</span>
          <span className="date-trigger-icon" aria-hidden="true">
            ▾
          </span>
        </button>

        {isOpen ? (
          <div className="date-popover" style={{ zIndex: 10000 }}>
            <div className="date-popover-header">
              <button
                type="button"
                className="calendar-nav-button"
                onClick={() =>
                  setViewDate(
                    (current) =>
                      new Date(current.getFullYear(), current.getMonth() - 1, 1)
                  )
                }
              >
                ‹
              </button>
              <div className="calendar-selectors">
                <SelectField
                  id={`${id}-month`}
                  label="Mes"
                  hideLabel
                  includePlaceholder={false}
                  className="calendar-select-field"
                  value={String(viewDate.getMonth())}
                  onChange={(event) =>
                    setViewDate(
                      (current) =>
                        new Date(
                          current.getFullYear(),
                          Number(event.target.value),
                          1
                        )
                    )
                  }
                  options={monthOptions.map((month, index) => ({
                    value: String(index),
                    label: month
                  }))}
                />

                <SelectField
                  id={`${id}-year`}
                  label="Año"
                  hideLabel
                  includePlaceholder={false}
                  className="calendar-select-field"
                  value={String(viewDate.getFullYear())}
                  onChange={(event) =>
                    setViewDate(
                      (current) =>
                        new Date(
                          Number(event.target.value),
                          current.getMonth(),
                          1
                        )
                    )
                  }
                  options={yearOptions.map((year) => ({
                    value: String(year),
                    label: String(year)
                  }))}
                />
              </div>
              <button
                type="button"
                className="calendar-nav-button"
                onClick={() =>
                  setViewDate(
                    (current) =>
                      new Date(current.getFullYear(), current.getMonth() + 1, 1)
                  )
                }
              >
                ›
              </button>
            </div>

            <div className="calendar-weekdays">
              {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {calendarDays.map((calendarDay) => {
                const dayValue = formatDateValue(calendarDay.value);
                const isSelected = selectedDate
                  ? dayValue === formatDateValue(selectedDate)
                  : false;
                const isBeforeMin = effectiveMinValue ? dayValue < effectiveMinValue : false;
                const isAfterMax = effectiveMaxValue ? dayValue > effectiveMaxValue : false;

                return (
                  <button
                    key={calendarDay.key}
                    type="button"
                    className={
                      isSelected
                        ? "calendar-day calendar-day-selected"
                        : calendarDay.inMonth
                          ? "calendar-day"
                          : "calendar-day calendar-day-muted"
                    }
                    disabled={isBeforeMin || isAfterMax}
                    onClick={() => {
                      onChange(dayValue);
                      setViewDate(
                        new Date(
                          calendarDay.value.getFullYear(),
                          calendarDay.value.getMonth(),
                          1
                        )
                      );
                      setIsOpen(false);
                    }}
                  >
                    {calendarDay.value.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
