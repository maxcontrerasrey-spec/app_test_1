function toDateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function formatDurationParts(years: number, months: number, days: number) {
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "año" : "años"}`);
  }

  if (months > 0) {
    parts.push(`${months} ${months === 1 ? "mes" : "meses"}`);
  }

  if (days > 0 || parts.length === 0) {
    parts.push(`${days} ${days === 1 ? "día" : "días"}`);
  }

  return parts.join(" ");
}

export function formatOpenDuration(
  openedAt: string | null | undefined,
  referenceDate: Date = new Date()
) {
  if (!openedAt) {
    return "No disponible";
  }

  const openedDate = new Date(openedAt);

  if (Number.isNaN(openedDate.getTime())) {
    return "No disponible";
  }

  const startDate = toDateOnly(openedDate);
  const endDate = toDateOnly(referenceDate);

  if (startDate.getTime() >= endDate.getTime()) {
    return "0 días";
  }

  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();
  let days = endDate.getDate() - startDate.getDate();

  if (days < 0) {
    months -= 1;
    days += getDaysInMonth(endDate.getFullYear(), endDate.getMonth() - 1);
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return formatDurationParts(years, months, days);
}
