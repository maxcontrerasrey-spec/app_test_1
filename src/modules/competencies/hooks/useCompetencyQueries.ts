import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { searchCompetencyWorkers } from "../services/competencyCoreApi";

const COMPETENCY_SEARCH_STALE_TIME_MS = 15_000;
const COMPETENCY_SEARCH_GC_TIME_MS = 20 * 60_000;

export function useCompetencyWorkerSearch(search: string, enabled = true) {
  const normalizedSearch = search.trim();
  const documentDigits = normalizedSearch.replace(/\D/g, "");

  return useQuery({
    queryKey: queryKeys.competencies.workerSearch(normalizedSearch),
    queryFn: () => searchCompetencyWorkers(normalizedSearch),
    staleTime: COMPETENCY_SEARCH_STALE_TIME_MS,
    gcTime: COMPETENCY_SEARCH_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: enabled && (normalizedSearch.length >= 2 || documentDigits.length >= 4)
  });
}
