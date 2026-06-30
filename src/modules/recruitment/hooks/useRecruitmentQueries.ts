import { useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchRecruitmentActiveCaseOptions,
  fetchRecruitmentCaseDetail,
  fetchRecruitmentCandidatesPage,
  fetchRecruitmentControlSummary,
  fetchRecruitmentPendingApprovalsPage,
  fetchRecruitmentPersonnelToHirePage,
  fetchRecruitmentProcessesPage,
  type RecruitmentCandidateStage
} from "../services/hiringControl";
import { fetchHiringCatalogs } from "../services/hiringCatalogs";

const RECRUITMENT_DASHBOARD_STALE_TIME_MS = 20_000;
const RECRUITMENT_CASE_DETAIL_STALE_TIME_MS = 60_000;
const RECRUITMENT_CATALOGS_STALE_TIME_MS = 30 * 60_000;
const RECRUITMENT_CACHE_GC_TIME_MS = 15 * 60_000;
const RECRUITMENT_CATALOGS_GC_TIME_MS = 2 * 60 * 60_000;

export type RecruitmentProcessesPageFilters = {
  search?: string;
  statusFilter?: string | null;
  sortColumn?: string | null;
  sortDirection?: "asc" | "desc";
  limit: number;
  offset: number;
};

export type RecruitmentCandidatesPageFilters = {
  search?: string;
  stageFilter?: RecruitmentCandidateStage | "active" | "discarded";
  limit: number;
  offset: number;
};

export type RecruitmentPersonnelPageFilters = {
  search?: string;
  limit: number;
  offset: number;
};

export type RecruitmentApprovalsPageFilters = {
  limit: number;
  offset: number;
};

export function getRecruitmentControlSummaryQueryOptions() {
  return {
    queryKey: queryKeys.recruitment.controlSummary(),
    queryFn: async () => {
      const result = await fetchRecruitmentControlSummary();

      if (result.error || !result.data) {
        throw new Error(result.error ?? "No fue posible cargar el resumen.");
      }

      return result.data;
    },
    staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
    gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
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

export function useRecruitmentControlSummary() {
  return useQuery(getRecruitmentControlSummaryQueryOptions());
}

export function useRecruitmentPendingApprovalsPage(
  filters: RecruitmentApprovalsPageFilters,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.recruitment.approvals(filters),
    queryFn: async () => {
      const result = await fetchRecruitmentPendingApprovalsPage(filters);

      if (result.error || !result.data) {
        throw new Error(result.error ?? "No fue posible cargar aprobaciones pendientes.");
      }

      return result.data;
    },
    staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
    gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
    enabled
  });
}

export function useRecruitmentProcessesPage(filters: RecruitmentProcessesPageFilters) {
  return useQuery({
    queryKey: queryKeys.recruitment.processes(filters),
    queryFn: async () => {
      const result = await fetchRecruitmentProcessesPage(filters);

      if (result.error || !result.data) {
        throw new Error(result.error ?? "No fue posible cargar procesos de contratación.");
      }

      return result.data;
    },
    staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
    gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
    placeholderData: (previous) => previous,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}

export function useRecruitmentCandidatesPage(
  filters: RecruitmentCandidatesPageFilters,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.recruitment.candidates(filters),
    queryFn: async () => {
      const result = await fetchRecruitmentCandidatesPage(filters);

      if (result.error || !result.data) {
        throw new Error(result.error ?? "No fue posible cargar candidatos.");
      }

      return result.data;
    },
    staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
    gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
    refetchInterval: enabled ? 5 * 60_000 : false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled
  });
}

export function useRecruitmentPersonnelToHirePage(
  filters: RecruitmentPersonnelPageFilters,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.recruitment.personnel(filters),
    queryFn: async () => {
      const result = await fetchRecruitmentPersonnelToHirePage(filters);

      if (result.error || !result.data) {
        throw new Error(result.error ?? "No fue posible cargar personal a contratar.");
      }

      return result.data;
    },
    staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
    gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
    refetchInterval: enabled ? 5 * 60_000 : false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled
  });
}

export function useRecruitmentActiveCaseOptions(
  filters: { search?: string; limit?: number } = {},
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.recruitment.activeCaseOptions(filters),
    queryFn: async () => {
      const result = await fetchRecruitmentActiveCaseOptions(filters);

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: RECRUITMENT_CASE_DETAIL_STALE_TIME_MS,
    gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
    enabled
  });
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
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.controlSummary() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.approvalsRoot() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.processesRoot() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.candidatesRoot() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.personnelRoot() }),
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "recruitment" && query.queryKey[1] === "active-case-options"
    })
  ]);

  if (caseId) {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.recruitment.caseDetail(caseId)
    });
  }
}
