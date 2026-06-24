import { useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchRecruitmentCaseDetail,
  fetchRecruitmentControlDashboard
} from "../services/hiringControl";
import { fetchHiringCatalogs } from "../services/hiringCatalogs";

const RECRUITMENT_DASHBOARD_STALE_TIME_MS = 20_000;
const RECRUITMENT_CASE_DETAIL_STALE_TIME_MS = 60_000;
const RECRUITMENT_CATALOGS_STALE_TIME_MS = 30 * 60_000;
const RECRUITMENT_CACHE_GC_TIME_MS = 15 * 60_000;
const RECRUITMENT_CATALOGS_GC_TIME_MS = 2 * 60 * 60_000;

export function getRecruitmentControlDashboardQueryOptions() {
  return {
    queryKey: queryKeys.recruitment.controlDashboard(),
    queryFn: async () => {
      const result = await fetchRecruitmentControlDashboard();

      if (result.error || !result.data) {
        throw new Error(result.error ?? "No fue posible cargar el tablero.");
      }

      return result.data;
    },
    staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
    gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  };
}

export function getRecruitmentCaseDetailQueryOptions(caseId: string) {
  return {
    queryKey: queryKeys.recruitment.caseDetail(caseId),
    queryFn: async () => {
      const result = await fetchRecruitmentCaseDetail(caseId);

      if (result.error || !result.data) {
        throw new Error(result.error ?? "No fue posible cargar el detalle del caso.");
      }

      return result.data;
    },
    staleTime: RECRUITMENT_CASE_DETAIL_STALE_TIME_MS,
    gcTime: RECRUITMENT_CACHE_GC_TIME_MS
  };
}

export function getHiringCatalogsQueryOptions() {
  return {
    queryKey: queryKeys.recruitment.hiringCatalogs(),
    queryFn: async () => {
      const result = await fetchHiringCatalogs();

      if (result.error) {
        throw new Error(result.error);
      }

      return result;
    },
    staleTime: RECRUITMENT_CATALOGS_STALE_TIME_MS,
    gcTime: RECRUITMENT_CATALOGS_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  };
}

export function useRecruitmentControlDashboard() {
  return useQuery(getRecruitmentControlDashboardQueryOptions());
}

export function useRecruitmentCaseDetail(caseId: string, enabled = true) {
  return useQuery({
    ...getRecruitmentCaseDetailQueryOptions(caseId),
    enabled: enabled && Boolean(caseId)
  });
}

export function useHiringCatalogs() {
  return useQuery(getHiringCatalogsQueryOptions());
}

export async function invalidateRecruitmentControlQueries(
  queryClient: QueryClient,
  caseId?: string
) {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.recruitment.controlDashboard()
  });

  if (caseId) {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.recruitment.caseDetail(caseId)
    });
  }
}
