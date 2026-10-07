import type { QueryFunctionContext, QueryKey, UseQueryOptions } from "@tanstack/react-query";

export const WORKER_SEARCH_DEBOUNCE_MS = 200;
export const WORKER_SEARCH_STALE_TIME_MS = 5 * 60_000;
export const WORKER_SEARCH_GC_TIME_MS = 20 * 60_000;

/** Mirrors normalize_recruitment_search_text so equivalent input reuses one cache entry. */
export function normalizeWorkerSearchTerm(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-CL")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizeRutAwareSearchTerm(value: string) {
  const normalizedSearch = normalizeWorkerSearchTerm(value);
  const compactRut = normalizedSearch.replace(/[.\s-]/g, "");

  if (/^\d+k$/.test(compactRut)) {
    return compactRut.slice(0, -1);
  }

  return /^\d+$/.test(compactRut) ? compactRut : normalizedSearch;
}

/** Keeps numeric RUT lookups compatible with BUK projections that index only digits. */
export function normalizeRutAwareWorkerSearchTerm(value: string) {
  return normalizeRutAwareSearchTerm(value);
}

export function isWorkerSearchReady(value: string, minSearchLength = 2) {
  const normalizedValue = value.trim();
  const digitCount = normalizedValue.replace(/\D/g, "").length;
  const isNumericLookup = /^[\d.\-\skK]+$/.test(normalizedValue);

  return isNumericLookup
    ? digitCount >= Math.max(4, minSearchLength)
    : normalizedValue.length >= minSearchLength;
}

type WorkerSearchQueryOptions<TData> = {
  search: string;
  enabled?: boolean;
  minSearchLength?: number;
  allowEmptySearch?: boolean;
  normalizeSearch?: (value: string) => string;
  queryKey: (normalizedSearch: string) => QueryKey;
  query: (normalizedSearch: string, signal: AbortSignal) => Promise<TData>;
  staleTime?: number;
  gcTime?: number;
};

/** Shared React Query policy; each module supplies a scope-specific key and authorized RPC. */
export function createWorkerSearchQueryOptions<TData>({
  search,
  enabled = true,
  minSearchLength = 2,
  allowEmptySearch = false,
  normalizeSearch = normalizeWorkerSearchTerm,
  queryKey,
  query,
  staleTime = WORKER_SEARCH_STALE_TIME_MS,
  gcTime = WORKER_SEARCH_GC_TIME_MS
}: WorkerSearchQueryOptions<TData>): UseQueryOptions<TData, Error, TData, QueryKey> {
  const normalizedSearch = normalizeSearch(search);

  return {
    queryKey: queryKey(normalizedSearch),
    queryFn: ({ signal }: QueryFunctionContext<QueryKey>) => query(normalizedSearch, signal),
    staleTime,
    gcTime,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled:
      enabled &&
      (allowEmptySearch || isWorkerSearchReady(normalizedSearch, minSearchLength))
  };
}
