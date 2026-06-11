import { useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchInternalMobilityRequestDetail,
  fetchInternalMobilityRequests,
  fetchInternalMobilitySetupCatalogs,
  fetchInternalMobilityWorkerContext,
  searchInternalMobilityWorkers
} from "../services/internalMobilityApi";

const INTERNAL_MOBILITY_CATALOGS_STALE_TIME_MS = 15 * 60_000;
const INTERNAL_MOBILITY_REQUESTS_STALE_TIME_MS = 20_000;
const INTERNAL_MOBILITY_REQUESTS_REFETCH_MS = 30_000;
const INTERNAL_MOBILITY_WORKER_CONTEXT_STALE_TIME_MS = 60_000;
const INTERNAL_MOBILITY_SEARCH_STALE_TIME_MS = 15_000;
const INTERNAL_MOBILITY_CACHE_GC_TIME_MS = 20 * 60_000;

export function useInternalMobilitySetupCatalogs() {
  return useQuery({
    queryKey: queryKeys.internalMobility.setupCatalogs(),
    queryFn: fetchInternalMobilitySetupCatalogs,
    staleTime: INTERNAL_MOBILITY_CATALOGS_STALE_TIME_MS,
    gcTime: INTERNAL_MOBILITY_CACHE_GC_TIME_MS
  });
}

export function useInternalMobilityWorkerSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.internalMobility.workerSearch(search),
    queryFn: () => searchInternalMobilityWorkers(search),
    staleTime: INTERNAL_MOBILITY_SEARCH_STALE_TIME_MS,
    gcTime: INTERNAL_MOBILITY_CACHE_GC_TIME_MS,
    enabled: enabled && search.trim().length >= 2
  });
}

export function useInternalMobilityWorkerContext(bukEmployeeId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.internalMobility.workerContext(bukEmployeeId),
    queryFn: () => fetchInternalMobilityWorkerContext(bukEmployeeId),
    staleTime: INTERNAL_MOBILITY_WORKER_CONTEXT_STALE_TIME_MS,
    gcTime: INTERNAL_MOBILITY_CACHE_GC_TIME_MS,
    enabled: enabled && Boolean(bukEmployeeId)
  });
}

export function useInternalMobilityRequests() {
  return useQuery({
    queryKey: queryKeys.internalMobility.requests(),
    queryFn: fetchInternalMobilityRequests,
    staleTime: INTERNAL_MOBILITY_REQUESTS_STALE_TIME_MS,
    gcTime: INTERNAL_MOBILITY_CACHE_GC_TIME_MS,
    refetchInterval: INTERNAL_MOBILITY_REQUESTS_REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
}

export function useInternalMobilityRequestDetail(requestId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.internalMobility.requestDetail(requestId),
    queryFn: () => fetchInternalMobilityRequestDetail(requestId),
    staleTime: INTERNAL_MOBILITY_REQUESTS_STALE_TIME_MS,
    gcTime: INTERNAL_MOBILITY_CACHE_GC_TIME_MS,
    enabled: enabled && Boolean(requestId)
  });
}

export async function invalidateInternalMobilityQueries(queryClient: QueryClient, requestId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.internalMobility.setupCatalogs() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.internalMobility.requestsRoot() })
  ]);

  if (requestId) {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.internalMobility.requestDetail(requestId)
    });
  }
}
