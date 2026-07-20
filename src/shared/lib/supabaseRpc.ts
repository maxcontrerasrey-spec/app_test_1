import { supabase } from "./supabase";

export type SupabaseRpcError = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

export type SupabaseErrorFormatMode = "annotated" | "plain" | "message";

const NETWORK_ERROR_MESSAGE =
  "No fue posible conectar con Supabase. Revisa tu conexión e intenta nuevamente.";

const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /load failed/i,
  /networkerror/i,
  /network request failed/i,
  /the internet connection appears to be offline/i
];

const STACK_TRACE_PATTERN = /\s+at\s+(?:https?:\/\/|\/|[A-Za-z]:\\).*/s;

function readErrorField(error: unknown, field: keyof SupabaseRpcError): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSupabaseError(error: unknown): SupabaseRpcError {
  if (!error || typeof error !== "object") {
    return {
      message: typeof error === "string" ? error : ""
    };
  }

  return {
    message: readErrorField(error, "message"),
    details: readErrorField(error, "details"),
    hint: readErrorField(error, "hint"),
    code: readErrorField(error, "code")
  };
}

function sanitizeErrorPart(value?: string | null): string {
  return value?.replace(STACK_TRACE_PATTERN, "").trim() ?? "";
}

function isNetworkSupabaseError(error: unknown) {
  const normalized = normalizeSupabaseError(error);
  const candidates = [
    normalized.message,
    normalized.details,
    normalized.hint,
    error instanceof Error ? error.name : "",
    typeof error === "string" ? error : ""
  ]
    .filter(Boolean)
    .join(" ");

  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(candidates));
}

export function getSupabaseClientOrThrow(
  errorMessage = "Supabase no está configurado en este entorno."
) {
  if (!supabase) {
    throw new Error(errorMessage);
  }

  return supabase;
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function readText(value: unknown, fallback = ""): string {
  return String(value ?? fallback);
}

export function readNullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function readBoolean(value: unknown): boolean {
  return Boolean(value);
}

export function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

export function readNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function readNullableTimestamp(value: unknown): string | null {
  return readNullableText(value);
}

export function formatSupabaseError(
  error: unknown,
  mode: SupabaseErrorFormatMode = "annotated"
) {
  if (isNetworkSupabaseError(error)) {
    return NETWORK_ERROR_MESSAGE;
  }

  const normalized = normalizeSupabaseError(error);
  const message = sanitizeErrorPart(normalized.message);

  if (mode === "message") {
    return message;
  }

  const rawDetails = sanitizeErrorPart(normalized.details);
  const rawHint = sanitizeErrorPart(normalized.hint);
  const details = rawDetails
    ? mode === "annotated"
      ? `Detalles: ${rawDetails}`
      : rawDetails
    : "";
  const hint = rawHint
    ? mode === "annotated"
      ? `Sugerencia: ${rawHint}`
      : rawHint
    : "";
  const code = sanitizeErrorPart(normalized.code);

  return [message, details, hint, code ? `Código: ${code}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export function getSupabaseErrorMessage(
  error: unknown,
  fallback: string,
  mode: SupabaseErrorFormatMode = "annotated"
) {
  return formatSupabaseError(error, mode) || fallback;
}
