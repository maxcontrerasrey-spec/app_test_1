import { useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchAccreditationDashboard,
  fetchAccreditationSetupCatalogs,
  fetchWorkerAccreditationProfile,
  searchAccreditationWorkers
} from "../services/accreditationApi";

const ACCREDITATION_STALE_TIME_MS = 30_000;
const ACCREDITATION_SETUP_STALE_TIME_MS = 5 * 60_000;
const ACCREDITATION_GC_TIME_MS = 20 * 60_000;

export function useAccreditationSetupCatalogs(enabled = true) {
  return useQuery({
    queryKey: queryKeys.accreditation.setupCatalogs(),
    queryFn: fetchAccreditationSetupCatalogs,
    staleTime: ACCREDITATION_SETUP_STALE_TIME_MS,
    gcTime: ACCREDITATION_GC_TIME_MS,
    enabled
  });
}

export function useAccreditationDashboard(filters: {
  siteId?: string | null;
  jobTitle?: string | null;
  enabled?: boolean;
}) {
  const { enabled = true, ...rest } = filters;

  return useQuery({
    queryKey: queryKeys.accreditation.dashboard(rest),
    queryFn: () => fetchAccreditationDashboard(rest),
    staleTime: ACCREDITATION_STALE_TIME_MS,
    gcTime: ACCREDITATION_GC_TIME_MS,
    enabled
  });
}

export function useAccreditationWorkers(filters: {
  search?: string;
  siteId?: string | null;
  status?: string | null;
  limit?: number;
  enabled?: boolean;
}) {
  const { enabled = true, ...rest } = filters;

  return useQuery({
    queryKey: queryKeys.accreditation.workers(rest),
    queryFn: () => searchAccreditationWorkers(rest),
    staleTime: ACCREDITATION_STALE_TIME_MS,
    gcTime: ACCREDITATION_GC_TIME_MS,
    enabled
  });
}

export function useWorkerAccreditationProfile(params: {
  bukEmployeeId: string;
  siteId: string;
  enabled?: boolean;
}) {
  const { bukEmployeeId, siteId, enabled = true } = params;

  return useQuery({
    queryKey: queryKeys.accreditation.workerProfile(bukEmployeeId, siteId),
    queryFn: () => fetchWorkerAccreditationProfile(bukEmployeeId, siteId),
    staleTime: ACCREDITATION_STALE_TIME_MS,
    gcTime: ACCREDITATION_GC_TIME_MS,
    enabled: enabled && Boolean(bukEmployeeId) && Boolean(siteId)
  });
}

export async function invalidateAccreditationQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.accreditation.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.roster.all() })
  ]);
}
