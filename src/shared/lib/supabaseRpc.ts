import { supabase } from "./supabase";

export type SupabaseRpcError = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

export type SupabaseErrorFormatMode = "annotated" | "plain" | "message";

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
  error: SupabaseRpcError,
  mode: SupabaseErrorFormatMode = "annotated"
) {
  if (mode === "message") {
    return error.message?.trim() || "";
  }

  const details = error.details
    ? mode === "annotated"
      ? `Detalles: ${error.details}`
      : error.details
    : "";
  const hint = error.hint
    ? mode === "annotated"
      ? `Sugerencia: ${error.hint}`
      : error.hint
    : "";

  return [error.message, details, hint, error.code ? `Código: ${error.code}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export function getSupabaseErrorMessage(
  error: SupabaseRpcError,
  fallback: string,
  mode: SupabaseErrorFormatMode = "annotated"
) {
  return formatSupabaseError(error, mode) || fallback;
}
