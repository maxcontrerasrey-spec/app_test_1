import { useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchHrSanctionRequestsPage,
  fetchHrSanctionSetupCatalogs,
  searchHrSanctionWorkers
} from "../services/sanctionsApi";
import type { HrSanctionRequestsPageFilters } from "../types";

const SANCTIONS_CATALOGS_STALE_TIME_MS = 5 * 60_000;
const SANCTIONS_REQUESTS_STALE_TIME_MS = 30_000;
const SANCTIONS_SEARCH_STALE_TIME_MS = 15_000;
const SANCTIONS_CACHE_GC_TIME_MS = 20 * 60_000;

export function useHrSanctionSetupCatalogs(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sanctions.setupCatalogs(),
    queryFn: fetchHrSanctionSetupCatalogs,
    staleTime: SANCTIONS_CATALOGS_STALE_TIME_MS,
    gcTime: SANCTIONS_CACHE_GC_TIME_MS,
    enabled
  });
}

export function useHrSanctionWorkerSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sanctions.workerSearch(search),
    queryFn: () => searchHrSanctionWorkers(search),
    staleTime: SANCTIONS_SEARCH_STALE_TIME_MS,
    gcTime: SANCTIONS_CACHE_GC_TIME_MS,
    enabled: enabled && search.trim().length >= 2
  });
}

export function useHrSanctionRequestsPage(filters: HrSanctionRequestsPageFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sanctions.requestsPage(filters),
    queryFn: () => fetchHrSanctionRequestsPage(filters),
    staleTime: SANCTIONS_REQUESTS_STALE_TIME_MS,
    gcTime: SANCTIONS_CACHE_GC_TIME_MS,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previous) => previous,
    enabled
  });
}

export async function invalidateHrSanctionQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.sanctions.setupCatalogs() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.sanctions.requestsRoot() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.sanctions.requestDetailRoot() })
  ]);
}
