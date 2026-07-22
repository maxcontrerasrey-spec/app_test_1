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
  fetchBiVacationForecast,
  fetchBiMedicalLeaveByArea,
  fetchBiRecruitmentPipeline,
  fetchBiRecruitmentDashboard
} from "../services/biApi";

const BI_STALE_TIME = 1000 * 60 * 5; // 5 minutos, según lección 48 no ahogar Supabase con polling

export function useBiWorkforceOverview(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.workforceOverview(filters),
    queryFn: () => fetchBiWorkforceOverview(filters),
    staleTime: BI_STALE_TIME
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

export function useBiPresenceSummaryToday(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.presenceSummaryToday(filters),
    queryFn: () => fetchBiPresenceSummaryToday(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiExceptionsMonthly(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.exceptionsMonthly(filters),
    queryFn: () => fetchBiExceptionsMonthly(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiVacationForecast(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.vacationForecast(filters),
    queryFn: () => fetchBiVacationForecast(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiMedicalLeaveByArea(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.medicalLeaveByArea(filters),
    queryFn: () => fetchBiMedicalLeaveByArea(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiRecruitmentPipeline(filters?: BiFilters) {
  return useQuery({
    queryKey: queryKeys.bi.recruitmentPipeline(filters),
    queryFn: () => fetchBiRecruitmentPipeline(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiRecruitmentDashboard(filters?: BiFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.bi.recruitmentDashboard(filters),
    queryFn: () => fetchBiRecruitmentDashboard(filters),
    staleTime: BI_STALE_TIME,
    enabled
  });
}
