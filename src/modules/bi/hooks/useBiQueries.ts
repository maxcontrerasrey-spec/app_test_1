import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import type { BiFilters } from "../types";
import {
  fetchBiWorkforceOverview,
  fetchBiHeadcountByContract,
  fetchBiHeadcountByJobTitle,
  fetchBiHeadcountByCity,
  fetchBiAgeDistribution,
  fetchBiExceptionsToday,
  fetchBiPresenceSummaryToday,
  fetchBiExceptionsMonthly,
  fetchBiAbsenteeismTrend,
  fetchBiRecruitmentPipeline,
  fetchBiRecruitmentDashboard
} from "../services/biApi";

const BI_STALE_TIME = 1000 * 60 * 5; // 5 minutos, según lección 48 no ahogar Supabase con polling
export const BI_RECRUITMENT_DASHBOARD_STALE_TIME_MS = 1000 * 60 * 2;
export const BI_RECRUITMENT_DASHBOARD_GC_TIME_MS = 1000 * 60 * 15;

export function useBiWorkforceOverview(filters?: BiFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.bi.workforceOverview(filters),
    queryFn: () => fetchBiWorkforceOverview(filters),
    staleTime: BI_STALE_TIME,
    enabled
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

export function useBiHeadcountByCity(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.headcountByCity(filters),
    queryFn: () => fetchBiHeadcountByCity(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiAgeDistribution(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.ageDistribution(filters),
    queryFn: () => fetchBiAgeDistribution(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiExceptionsToday(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.exceptionsToday(filters),
    queryFn: () => fetchBiExceptionsToday(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiPresenceSummaryToday(filters?: BiFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.bi.presenceSummaryToday(filters),
    queryFn: () => fetchBiPresenceSummaryToday(filters),
    staleTime: BI_STALE_TIME,
    enabled
  });
}

export function useBiExceptionsMonthly(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.exceptionsMonthly(filters),
    queryFn: () => fetchBiExceptionsMonthly(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiRecruitmentPipeline(filters?: BiFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.bi.recruitmentPipeline(filters),
    queryFn: () => fetchBiRecruitmentPipeline(filters),
    staleTime: BI_STALE_TIME,
    enabled
  });
}

export function useBiAbsenteeismTrend(filters: BiFilters | undefined, periodCodes: string[], enabled = true) {
  return useQuery({
    queryKey: queryKeys.bi.absenteeismTrend(filters, periodCodes),
    queryFn: () => fetchBiAbsenteeismTrend(filters, periodCodes),
    staleTime: BI_STALE_TIME,
    enabled: enabled && periodCodes.length > 0
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
