import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  createWorkerSearchQueryOptions,
  WORKER_SEARCH_GC_TIME_MS,
  WORKER_SEARCH_STALE_TIME_MS,
  normalizeRutAwareWorkerSearchTerm
} from "../../../shared/lib/workerSearch";
import { searchCompetencyWorkers } from "../services/competencyCoreApi";

export function useCompetencyWorkerSearch(search: string, enabled = true) {
  return useQuery(createWorkerSearchQueryOptions({
    search,
    enabled,
    normalizeSearch: normalizeRutAwareWorkerSearchTerm,
    queryKey: (normalizedSearch) => queryKeys.competencies.workerSearch(normalizedSearch),
    query: (normalizedSearch, signal) => searchCompetencyWorkers(normalizedSearch, 20, signal),
    staleTime: WORKER_SEARCH_STALE_TIME_MS,
    gcTime: WORKER_SEARCH_GC_TIME_MS
  }));
}
