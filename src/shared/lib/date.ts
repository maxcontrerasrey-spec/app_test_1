export const monthOptions = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

export function toTodayDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function formatDateForDisplay(dateValue: string) {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

export function addMonthsToDateValue(dateValue: string, monthsToAdd: number) {
  if (!dateValue) {
    return "";
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const targetMonthIndex = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const targetMonth = normalizedMonthIndex;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(
    targetDay
  ).padStart(2, "0")}`;
}

export function addThreeMonths(dateValue: string) {
  return addMonthsToDateValue(dateValue, 3);
}

export function toMonthInputValue(dateValue: string) {
  return dateValue.slice(0, 7);
}

export function parseDateValue(dateValue: string) {
  if (!dateValue) return new Date();
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateValue(dateObject: Date) {
  return `${dateObject.getFullYear()}-${String(dateObject.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(dateObject.getDate()).padStart(2, "0")}`;
}

export function buildCalendarDays(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const leadingDays = (firstDayOfMonth.getDay() + 6) % 7;
  const totalDays = lastDayOfMonth.getDate();
  const calendarDays: Array<{ key: string; value: Date; inMonth: boolean }> = [];

  for (let index = leadingDays; index > 0; index -= 1) {
    const date = new Date(year, month, 1 - index);
    calendarDays.push({
      key: `prev-${formatDateValue(date)}`,
      value: date,
      inMonth: false
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    calendarDays.push({
      key: `current-${formatDateValue(date)}`,
      value: date,
      inMonth: true
    });
  }

  while (calendarDays.length % 7 !== 0) {
    const date = new Date(year, month, totalDays + (calendarDays.length % 7) + 1);
    calendarDays.push({
      key: `next-${formatDateValue(date)}`,
      value: date,
      inMonth: false
    });
  }

  return calendarDays;
}

export function getDaysSince(dateValue: string | null | undefined) {
  if (!dateValue) return null;

  const sourceDate = new Date(dateValue);
  if (Number.isNaN(sourceDate.getTime())) {
    return null;
  }

  const today = new Date();
  const sourceDay = new Date(sourceDate.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = todayDay.getTime() - sourceDay.getTime();

  return Math.max(0, Math.floor(diffMs / 86400000));
}
