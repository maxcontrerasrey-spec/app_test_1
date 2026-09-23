import { useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchRosterCalendarSummary,
  fetchRosterBulkCalendar,
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

  return useQuery({
    queryKey: queryKeys.roster.calendarSummary({
      monthValue,
      search,
      contractFilter,
      areaFilter
    }),
    queryFn: ({ signal }) =>
      fetchRosterCalendarSummary({
        monthValue,
        search,
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

export function useRosterBulkCalendar(params: {
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
  return useQuery({
    queryKey: queryKeys.roster.bulkCalendar({
      monthValue: `${startDate}:${endDate}`,
      search,
      contractFilter,
      areaFilter,
      contractAdministratorFilter
    }),
    queryFn: ({ signal }) => fetchRosterBulkCalendar({
      startDate,
      endDate,
      search,
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

export function useRosterWorkerSearch(search: string, enabled = true) {
  const normalizedSearch = search.trim().toLocaleLowerCase("es-CL");

  return useQuery({
    queryKey: queryKeys.roster.workerSearch(normalizedSearch),
    queryFn: ({ signal }) => searchRosterWorkers(normalizedSearch, 12, signal),
    staleTime: 5 * 60_000,
    gcTime: ROSTER_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: enabled && normalizedSearch.length >= 2
  });
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
