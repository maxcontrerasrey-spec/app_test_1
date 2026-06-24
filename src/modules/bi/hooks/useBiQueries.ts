import { useQuery } from "@tanstack/react-query";
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

function normalizeFilters(filters?: BiFilters) {
  return {
    periodCode: filters?.periodCode?.trim() || "",
    contractCodes: [...(filters?.contractCodes ?? [])].filter(Boolean).sort(),
    jobTitles: [...(filters?.jobTitles ?? [])].filter(Boolean).sort(),
    managementNames: [...(filters?.managementNames ?? [])].filter(Boolean).sort()
  };
}

export const BI_QUERY_KEYS = {
  all: ["bi"] as const,
  workforceOverview: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "workforceOverview", normalizeFilters(filters)] as const,
  headcountByContract: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "headcountByContract", normalizeFilters(filters)] as const,
  headcountByJobTitle: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "headcountByJobTitle", normalizeFilters(filters)] as const,
  headcountByCity: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "headcountByCity", normalizeFilters(filters)] as const,
  ageDistribution: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "ageDistribution", normalizeFilters(filters)] as const,
  exceptionsToday: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "exceptionsToday", normalizeFilters(filters)] as const,
  presenceSummaryToday: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "presenceSummaryToday", normalizeFilters(filters)] as const,
  exceptionsMonthly: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "exceptionsMonthly", normalizeFilters(filters)] as const,
  vacationForecast: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "vacationForecast", normalizeFilters(filters)] as const,
  medicalLeaveByArea: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "medicalLeaveByArea", normalizeFilters(filters)] as const,
  recruitmentPipeline: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "recruitmentPipeline", normalizeFilters(filters)] as const,
  recruitmentDashboard: (filters?: BiFilters) =>
    [...BI_QUERY_KEYS.all, "recruitmentDashboard", normalizeFilters(filters)] as const
};

export function useBiWorkforceOverview(filters?: BiFilters) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.workforceOverview(filters),
    queryFn: () => fetchBiWorkforceOverview(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiHeadcountByContract(filters?: BiFilters, enabled = true) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.headcountByContract(filters),
    queryFn: () => fetchBiHeadcountByContract(filters),
    staleTime: BI_STALE_TIME,
    enabled
  });
}

export function useBiHeadcountByJobTitle(filters?: BiFilters, enabled = true) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.headcountByJobTitle(filters),
    queryFn: () => fetchBiHeadcountByJobTitle(filters),
    staleTime: BI_STALE_TIME,
    enabled
  });
}

export function useBiHeadcountByCity(filters?: BiFilters) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.headcountByCity(filters),
    queryFn: () => fetchBiHeadcountByCity(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiAgeDistribution(filters?: BiFilters) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.ageDistribution(filters),
    queryFn: () => fetchBiAgeDistribution(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiExceptionsToday(filters?: BiFilters) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.exceptionsToday(filters),
    queryFn: () => fetchBiExceptionsToday(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiPresenceSummaryToday(filters?: BiFilters) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.presenceSummaryToday(filters),
    queryFn: () => fetchBiPresenceSummaryToday(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiExceptionsMonthly(filters?: BiFilters) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.exceptionsMonthly(filters),
    queryFn: () => fetchBiExceptionsMonthly(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiVacationForecast(filters?: BiFilters) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.vacationForecast(filters),
    queryFn: () => fetchBiVacationForecast(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiMedicalLeaveByArea(filters?: BiFilters) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.medicalLeaveByArea(filters),
    queryFn: () => fetchBiMedicalLeaveByArea(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiRecruitmentPipeline(filters?: BiFilters) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.recruitmentPipeline(filters),
    queryFn: () => fetchBiRecruitmentPipeline(filters),
    staleTime: BI_STALE_TIME
  });
}

export function useBiRecruitmentDashboard(filters?: BiFilters, enabled = true) {
  return useQuery({
    queryKey: BI_QUERY_KEYS.recruitmentDashboard(filters),
    queryFn: () => fetchBiRecruitmentDashboard(filters),
    staleTime: BI_STALE_TIME,
    enabled
  });
}
