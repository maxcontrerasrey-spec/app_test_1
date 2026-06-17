import { useQuery } from "@tanstack/react-query";
import {
  fetchBiWorkforceOverview,
  fetchBiHeadcountByContract,
  fetchBiHeadcountByJobTitle,
  fetchBiAgeDistribution,
  fetchBiExceptionsToday,
  fetchBiPresenceSummaryToday,
  fetchBiExceptionsMonthly,
  fetchBiVacationForecast,
  fetchBiMedicalLeaveByArea,
  fetchBiRecruitmentPipeline,
  fetchBiHiringVelocity
} from "../services/biApi";

const BI_STALE_TIME = 1000 * 60 * 5; // 5 minutos, según lección 48 no ahogar Supabase con polling

export const BI_QUERY_KEYS = {
  all: ["bi"] as const,
  workforceOverview: () => [...BI_QUERY_KEYS.all, "workforceOverview"] as const,
  headcountByContract: () => [...BI_QUERY_KEYS.all, "headcountByContract"] as const,
  headcountByJobTitle: () => [...BI_QUERY_KEYS.all, "headcountByJobTitle"] as const,
  ageDistribution: () => [...BI_QUERY_KEYS.all, "ageDistribution"] as const,
  exceptionsToday: () => [...BI_QUERY_KEYS.all, "exceptionsToday"] as const,
  presenceSummaryToday: () => [...BI_QUERY_KEYS.all, "presenceSummaryToday"] as const,
  exceptionsMonthly: () => [...BI_QUERY_KEYS.all, "exceptionsMonthly"] as const,
  vacationForecast: () => [...BI_QUERY_KEYS.all, "vacationForecast"] as const,
  medicalLeaveByArea: () => [...BI_QUERY_KEYS.all, "medicalLeaveByArea"] as const,
  recruitmentPipeline: () => [...BI_QUERY_KEYS.all, "recruitmentPipeline"] as const,
  hiringVelocity: () => [...BI_QUERY_KEYS.all, "hiringVelocity"] as const
};

export function useBiWorkforceOverview() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.workforceOverview(),
    queryFn: fetchBiWorkforceOverview,
    staleTime: BI_STALE_TIME
  });
}

export function useBiHeadcountByContract() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.headcountByContract(),
    queryFn: fetchBiHeadcountByContract,
    staleTime: BI_STALE_TIME
  });
}

export function useBiHeadcountByJobTitle() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.headcountByJobTitle(),
    queryFn: fetchBiHeadcountByJobTitle,
    staleTime: BI_STALE_TIME
  });
}

export function useBiAgeDistribution() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.ageDistribution(),
    queryFn: fetchBiAgeDistribution,
    staleTime: BI_STALE_TIME
  });
}

export function useBiExceptionsToday() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.exceptionsToday(),
    queryFn: fetchBiExceptionsToday,
    staleTime: BI_STALE_TIME
  });
}

export function useBiPresenceSummaryToday() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.presenceSummaryToday(),
    queryFn: fetchBiPresenceSummaryToday,
    staleTime: BI_STALE_TIME
  });
}

export function useBiExceptionsMonthly() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.exceptionsMonthly(),
    queryFn: fetchBiExceptionsMonthly,
    staleTime: BI_STALE_TIME
  });
}

export function useBiVacationForecast() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.vacationForecast(),
    queryFn: fetchBiVacationForecast,
    staleTime: BI_STALE_TIME
  });
}

export function useBiMedicalLeaveByArea() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.medicalLeaveByArea(),
    queryFn: fetchBiMedicalLeaveByArea,
    staleTime: BI_STALE_TIME
  });
}

export function useBiRecruitmentPipeline() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.recruitmentPipeline(),
    queryFn: fetchBiRecruitmentPipeline,
    staleTime: BI_STALE_TIME
  });
}

export function useBiHiringVelocity() {
  return useQuery({
    queryKey: BI_QUERY_KEYS.hiringVelocity(),
    queryFn: fetchBiHiringVelocity,
    staleTime: BI_STALE_TIME
  });
}
