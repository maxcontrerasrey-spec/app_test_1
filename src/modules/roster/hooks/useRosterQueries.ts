import { useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  createWorkerSearchQueryOptions,
  WORKER_SEARCH_GC_TIME_MS,
  WORKER_SEARCH_STALE_TIME_MS,
  normalizeRutAwareWorkerSearchTerm
} from "../../../shared/lib/workerSearch";
import {
  fetchRosterCalendarSummary,
  fetchRosterBulkCalendarPage,
  fetchRosterCalendarScopeSummary,
  fetchRosterSetupCatalogs,
  fetchWorkerSchedule,
  searchRosterWorkers
} from "../services/rosterApi";

const ROSTER_STALE_TIME_MS = 30_000;
const ROSTER_SETUP_STALE_TIME_MS = 5 * 60_000;
const ROSTER_GC_TIME_MS = 20 * 60_000;

export function useRosterSetupCatalogs(enabled = true) {
  return useQuery({
    queryKey: queryKeys.roster.setupCatalogs(),
    queryFn: fetchRosterSetupCatalogs,
    staleTime: ROSTER_SETUP_STALE_TIME_MS,
    gcTime: ROSTER_GC_TIME_MS,
    enabled
  });
}

export function useRosterCalendarSummary(params: {
  monthValue: string;
  search?: string;
  contractFilter?: string;
  areaFilter?: string;
  enabled?: boolean;
}) {
  const {
    monthValue,
    search = "",
    contractFilter = "",
    areaFilter = "",
    enabled = true
  } = params;
  const normalizedSearch = normalizeRutAwareWorkerSearchTerm(search);

  return useQuery({
    queryKey: queryKeys.roster.calendarSummary({
      monthValue,
      search: normalizedSearch,
      contractFilter,
      areaFilter
    }),
    queryFn: ({ signal }) =>
      fetchRosterCalendarSummary({
        monthValue,
        search: normalizedSearch,
        contractFilter,
        areaFilter
      }, signal),
    staleTime: ROSTER_STALE_TIME_MS,
    gcTime: ROSTER_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: enabled && Boolean(monthValue)
  });
}

export function useRosterCalendarScopeSummary(params: {
  startDate: string;
  endDate: string;
  search?: string;
  contractFilter?: string;
  areaFilter?: string;
  contractAdministratorFilter?: string;
  enabled?: boolean;
}) {
  const {
    startDate,
    endDate,
    search = "",
    contractFilter = "",
    areaFilter = "",
    contractAdministratorFilter = "",
    enabled = true
  } = params;
  const normalizedSearch = normalizeRutAwareWorkerSearchTerm(search);

  return useQuery({
    queryKey: queryKeys.roster.calendarScopeSummary({
      startDate,
      endDate,
      search: normalizedSearch,
      contractFilter,
      areaFilter,
      contractAdministratorFilter
    }),
    queryFn: ({ signal }) => fetchRosterCalendarScopeSummary({
      startDate,
      endDate,
      search: normalizedSearch,
      contractFilter,
      areaFilter,
      contractAdministratorFilter
    }, signal),
    staleTime: ROSTER_STALE_TIME_MS,
    gcTime: ROSTER_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: enabled && Boolean(startDate) && Boolean(endDate)
  });
}

export function useRosterBulkCalendar(params: {
  startDate: string;
  endDate: string;
  search?: string;
  contractFilter?: string;
  areaFilter?: string;
  contractAdministratorFilter?: string;
  cycleFilter?: string;
  page?: number;
  pageSize?: number;
  cursor?: { fullName: string; bukEmployeeId: string } | null;
  enabled?: boolean;
}) {
  const {
    startDate,
    endDate,
    search = "",
    contractFilter = "",
    areaFilter = "",
    contractAdministratorFilter = "",
    cycleFilter = "",
    page = 1,
    pageSize = 50,
    cursor = null,
    enabled = true
  } = params;
  const normalizedSearch = normalizeRutAwareWorkerSearchTerm(search);
  return useQuery({
    queryKey: queryKeys.roster.bulkCalendar({
      monthValue: `${startDate}:${endDate}`,
      search: normalizedSearch,
      contractFilter,
      areaFilter,
      contractAdministratorFilter,
      cycleFilter,
      page,
      pageSize,
      cursor
    }),
    queryFn: ({ signal }) => fetchRosterBulkCalendarPage({
      startDate,
      endDate,
      search: normalizedSearch,
      contractFilter,
      areaFilter,
      contractAdministratorFilter,
      cycleFilter,
      page,
      pageSize,
      cursor
    }, signal),
    staleTime: ROSTER_STALE_TIME_MS,
    gcTime: ROSTER_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: enabled && Boolean(startDate) && Boolean(endDate)
  });
}

export function useRosterWorkerSearch(search: string, enabled = true) {
  return useQuery(createWorkerSearchQueryOptions({
    search,
    enabled,
    normalizeSearch: normalizeRutAwareWorkerSearchTerm,
    queryKey: (normalizedSearch) => queryKeys.roster.workerSearch(normalizedSearch),
    query: (normalizedSearch, signal) => searchRosterWorkers(normalizedSearch, 12, signal),
    staleTime: WORKER_SEARCH_STALE_TIME_MS,
    gcTime: WORKER_SEARCH_GC_TIME_MS
  }));
}

export function useWorkerSchedule(params: {
  bukEmployeeId: string;
  startDate: string;
  endDate: string;
  enabled?: boolean;
}) {
  const { bukEmployeeId, startDate, endDate, enabled = true } = params;

  return useQuery({
    queryKey: queryKeys.roster.workerSchedule({ bukEmployeeId, startDate, endDate }),
    queryFn: () => fetchWorkerSchedule({ bukEmployeeId, startDate, endDate }),
    staleTime: ROSTER_STALE_TIME_MS,
    gcTime: ROSTER_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: enabled && Boolean(bukEmployeeId) && Boolean(startDate) && Boolean(endDate)
  });
}

export async function invalidateRosterQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.roster.setupCatalogs() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.roster.all() })
  ]);
}
