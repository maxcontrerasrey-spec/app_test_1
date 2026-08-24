import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import type { BiFilters } from "../types";
import {
  fetchBiHeadcountByContract,
  fetchBiHeadcountByJobTitle,
  fetchBiRecruitmentDashboard,
  fetchBiDotacionDashboard
} from "../services/biApi";

const BI_STALE_TIME = 1000 * 60 * 5; // 5 minutos, según lección 48 no ahogar Supabase con polling
export const BI_RECRUITMENT_DASHBOARD_STALE_TIME_MS = 1000 * 60 * 2;
export const BI_RECRUITMENT_DASHBOARD_GC_TIME_MS = 1000 * 60 * 15;

export function useBiDotacionDashboard(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.dotacionDashboard(filters),
    queryFn: () => fetchBiDotacionDashboard(filters),
    staleTime: BI_STALE_TIME,
    gcTime: BI_STALE_TIME * 3,
    placeholderData: (previous) => previous
  });
}

export function useBiHeadcountByContract(filters?: BiFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.bi.headcountByContract(filters),
    queryFn: () => fetchBiHeadcountByContract(filters),
    staleTime: BI_STALE_TIME,
    enabled
  });
}

export function useBiHeadcountByJobTitle(filters?: BiFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.bi.headcountByJobTitle(filters),
    queryFn: () => fetchBiHeadcountByJobTitle(filters),
    staleTime: BI_STALE_TIME,
    enabled
  });
}

export function useBiRecruitmentDashboard(filters?: BiFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.bi.recruitmentDashboard(filters),
    queryFn: () => fetchBiRecruitmentDashboard(filters),
    staleTime: BI_RECRUITMENT_DASHBOARD_STALE_TIME_MS,
    gcTime: BI_RECRUITMENT_DASHBOARD_GC_TIME_MS,
    refetchOnMount: false,
    enabled
  });
}
