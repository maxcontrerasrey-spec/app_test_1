/**
 * Shared formatting utilities for the SaaS platform.
 *
 * Consolidates format helpers previously duplicated across modules
 * (HomePage, OperacionesDashboard, etc.) into a single reusable module.
 */

const requestDateFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeStyle: "short",
});

const numberFormatter = new Intl.NumberFormat("es-CL");
const compactNumberFormatter = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const weekdayShortFormatter = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
});

/**
 * Formats an ISO date string to dd/MM/yyyy (es-CL locale).
 * Returns empty string for invalid or missing values.
 */
export function formatRequestDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return requestDateFormatter.format(date);
}

/**
 * Formats an ISO date-time string to a readable locale-aware label.
 * Returns the provided fallback when the value is missing or invalid.
 */
export function formatDateTimeLabel(
  value: string | null | undefined,
  fallback = "No disponible"
): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return dateTimeFormatter.format(date);
}

/**
 * Calculates and formats the number of days elapsed since a given ISO date.
 * Returns "Hoy" for same-day, "1 dia" for yesterday, "N dias" otherwise.
 */
export function formatDaysSince(value: string | null | undefined): string {
  if (!value) return "No disponible";
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return "No disponible";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfCreatedDay = new Date(createdAt);
  startOfCreatedDay.setHours(0, 0, 0, 0);

  const diffInMs = startOfToday.getTime() - startOfCreatedDay.getTime();
  const diffInDays = Math.max(0, Math.floor(diffInMs / 86_400_000));

  if (diffInDays === 0) return "Hoy";
  if (diffInDays === 1) return "1 dia";
  return `${diffInDays} dias`;
}

export function formatNumberValue(
  value: number | null | undefined,
  fallback = "No disponible"
): string {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return numberFormatter.format(value);
}

export function formatCompactNumberValue(
  value: number | null | undefined,
  fallback = "No disponible"
): string {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return compactNumberFormatter.format(value);
}

export function formatWeekdayShortLabel(
  value: string | number | Date,
  fallback = ""
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return weekdayShortFormatter.format(date).toUpperCase();
}

export function formatPercentValue(
  value: number | null | undefined,
  fractionDigits = 1,
  fallback = "No disponible"
): string {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return `${value.toFixed(fractionDigits)}%`;
}

type CurrencyFormatOptions = {
  fallback?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

/**
 * Formats a numeric value as CLP currency (Chilean pesos).
 * Returns "No disponible" for null/undefined/NaN.
 */
export function formatCurrencyValue(
  value: number | null | undefined,
  options?: CurrencyFormatOptions
): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return options?.fallback ?? "No disponible";
  }

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(value);
}

/**
 * Formats a boolean value to a human-readable label.
 * Returns "Si" for true, "No" for false, "No disponible" for null/undefined.
 */
export function formatBooleanLabel(value: boolean | null | undefined): string {
  if (value === true) return "Si";
  if (value === false) return "No";
  return "No disponible";
}

/**
 * Formats a person name or email-style identifier into a readable label.
 * Splits on dots, underscores, and hyphens to produce a proper name format.
 * Returns "No disponible" for empty values.
 */
export function formatPersonLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "No disponible";

  const normalized = value.trim();
  if (!normalized.includes(".") && !normalized.includes("_") && !normalized.includes("-")) {
    return normalized;
  }

  return normalized
    .split(/[._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}
