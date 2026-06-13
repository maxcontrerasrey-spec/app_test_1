import { useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
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

export function useRosterWorkerSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.roster.workerSearch(search),
    queryFn: () => searchRosterWorkers(search),
    staleTime: 15_000,
    gcTime: ROSTER_GC_TIME_MS,
    enabled: enabled && search.trim().length >= 2
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
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: enabled && Boolean(bukEmployeeId) && Boolean(startDate) && Boolean(endDate)
  });
}

export async function invalidateRosterQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.roster.setupCatalogs() }),
    queryClient.invalidateQueries({ queryKey: ["roster"] })
  ]);
}
