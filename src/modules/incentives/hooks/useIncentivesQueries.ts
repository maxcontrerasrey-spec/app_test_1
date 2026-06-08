import { useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchHrIncentivePreview,
  fetchHrIncentiveRequests,
  fetchHrIncentiveSetupCatalogs,
  fetchHrIncentiveWorkerContext,
  searchHrIncentiveEligibleWorkers
} from "../services/incentivesApi";
import type { HrIncentiveRequestsFilters } from "../types";

const INCENTIVES_CATALOGS_STALE_TIME_MS = 5 * 60_000;
const INCENTIVES_REQUESTS_STALE_TIME_MS = 20_000;
const INCENTIVES_REQUESTS_REFETCH_MS = 30_000;
const INCENTIVES_WORKER_CONTEXT_STALE_TIME_MS = 60_000;
const INCENTIVES_SEARCH_STALE_TIME_MS = 15_000;
const INCENTIVES_CACHE_GC_TIME_MS = 20 * 60_000;

export function useHrIncentiveSetupCatalogs() {
  return useQuery({
    queryKey: queryKeys.incentives.setupCatalogs(),
    queryFn: fetchHrIncentiveSetupCatalogs,
    staleTime: INCENTIVES_CATALOGS_STALE_TIME_MS,
    gcTime: INCENTIVES_CACHE_GC_TIME_MS
  });
}

export function useHrIncentiveRequests(filters: HrIncentiveRequestsFilters) {
  return useQuery({
    queryKey: queryKeys.incentives.requests(filters),
    queryFn: () => fetchHrIncentiveRequests(filters),
    staleTime: INCENTIVES_REQUESTS_STALE_TIME_MS,
    gcTime: INCENTIVES_CACHE_GC_TIME_MS,
    refetchInterval: INCENTIVES_REQUESTS_REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
}

export function useHrIncentiveWorkerSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.incentives.workerSearch(search),
    queryFn: () => searchHrIncentiveEligibleWorkers(search),
    staleTime: INCENTIVES_SEARCH_STALE_TIME_MS,
    gcTime: INCENTIVES_CACHE_GC_TIME_MS,
    enabled: enabled && search.trim().length >= 2
  });
}

export function useHrIncentiveWorkerContext(bukEmployeeId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.incentives.workerContext(bukEmployeeId),
    queryFn: () => fetchHrIncentiveWorkerContext(bukEmployeeId),
    staleTime: INCENTIVES_WORKER_CONTEXT_STALE_TIME_MS,
    gcTime: INCENTIVES_CACHE_GC_TIME_MS,
    enabled: enabled && Boolean(bukEmployeeId)
  });
}

export function useHrIncentivePreview(params: {
  bukEmployeeId: string;
  incentiveTypeId: string;
  selectedContractCode: string;
  durationHours?: number | null;
  serviceDate?: string | null;
  enabled?: boolean;
}) {
  const {
    bukEmployeeId,
    incentiveTypeId,
    selectedContractCode,
    durationHours,
    serviceDate,
    enabled = true
  } = params;

  return useQuery({
    queryKey: queryKeys.incentives.preview({
      bukEmployeeId,
      incentiveTypeId,
      selectedContractCode,
      durationHours: durationHours ?? null,
      serviceDate: serviceDate ?? null
    }),
    queryFn: () =>
      fetchHrIncentivePreview({
        bukEmployeeId,
        incentiveTypeId,
        selectedContractCode,
        durationHours,
        serviceDate
      }),
    staleTime: 10_000,
    gcTime: INCENTIVES_CACHE_GC_TIME_MS,
    enabled:
      enabled &&
      Boolean(bukEmployeeId) &&
      Boolean(incentiveTypeId) &&
      Boolean(selectedContractCode) &&
      Boolean(serviceDate)
  });
}

export async function invalidateHrIncentiveQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.incentives.setupCatalogs() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.incentives.requestsRoot() })
  ]);
}
