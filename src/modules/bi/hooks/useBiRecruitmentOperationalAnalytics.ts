import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchRecruitmentControlDashboard,
  toRecruitmentCandidateStageLabel,
  toRecruitmentCaseStatusLabel,
  type RecruitmentCandidateControlRow,
  type RecruitmentCaseListRow,
  type RecruitmentPersonnelToHireRow
} from "../../recruitment/services/hiringControl";
import {
  fetchInternalMobilityRequests
} from "../../internal_mobility/services/internalMobilityApi";
import type { InternalMobilityRequestSummary } from "../../internal_mobility/types";
import type {
  BiFilters,
  BiLabelValueDatum,
  BiRecruitmentOperationalAnalytics,
  BiRecruitmentOperationalTimelineDatum,
  BiRecruitmentVacancyByContractDatum
} from "../types";

const BI_RECRUITMENT_STALE_TIME = 1000 * 60 * 5;
const CANDIDATE_STAGES_IN_PROGRESS = new Set([
  "lead",
  "who_pending",
  "who_approved",
  "in_process",
  "medical_exams",
  "document_review"
]);

type RecruitmentControlData = NonNullable<
  Awaited<ReturnType<typeof fetchRecruitmentControlDashboard>>["data"]
>;

type RecruitmentDimensionRecord = {
  contractName: string;
  jobTitle: string;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("es-CL");
}

function isSameValue(left: string | null | undefined, selectedValues: string[]) {
  if (selectedValues.length === 0) {
    return true;
  }

  const normalizedValue = normalizeText(left);
  return selectedValues.some((value) => normalizeText(value) === normalizedValue);
}

function getPeriodCode(timestamp: string | null | undefined) {
  if (!timestamp) {
    return null;
  }

  const match = timestamp.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}${match[2]}` : null;
}

function matchesPeriod(timestamp: string | null | undefined, periodCode: string | undefined) {
  if (!periodCode) {
    return true;
  }

  return getPeriodCode(timestamp) === periodCode;
}

function sum(values: number[]) {
  return values.reduce((accumulator, value) => accumulator + value, 0);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((accumulator, value) => accumulator + value, 0) / values.length;
}

function diffHours(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) {
    return null;
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  const difference = endDate.getTime() - startDate.getTime();

  if (Number.isNaN(difference) || difference < 0) {
    return null;
  }

  return difference / (1000 * 60 * 60);
}

function buildRecruitmentDimensions(
  dashboard: RecruitmentControlData,
  mobility: InternalMobilityRequestSummary[],
  periodCode: string | undefined
) {
  const dimensions: RecruitmentDimensionRecord[] = [];

  dashboard.activeCases.forEach((item) => {
    if (!matchesPeriod(item.opened_at, periodCode)) {
      return;
    }

    dimensions.push({
      contractName: item.contract_name,
      jobTitle: item.job_position_name
    });
  });

  dashboard.pendingApprovals.forEach((item) => {
    const request = item.hiring_requests;
    if (!request || !matchesPeriod(item.created_at, periodCode)) {
      return;
    }

    dimensions.push({
      contractName: request.contract_name,
      jobTitle: request.job_position_name
    });
  });

  dashboard.candidateControl.forEach((item) => {
    if (!matchesPeriod(item.stage_entered_at, periodCode)) {
      return;
    }

    dimensions.push({
      contractName: item.contract_name,
      jobTitle: item.job_position_name
    });
  });

  mobility.forEach((item) => {
    if (!matchesPeriod(item.submittedAt, periodCode)) {
      return;
    }

    dimensions.push({
      contractName: item.destinationAreaName,
      jobTitle: item.destinationJobTitle
    });
  });

  return dimensions;
}

function buildAvailableOptions(
  dimensions: RecruitmentDimensionRecord[],
  selectedContracts: string[],
  selectedJobs: string[]
) {
  const contracts = new Set<string>();
  const jobs = new Set<string>();

  dimensions.forEach((item) => {
    if (item.contractName && isSameValue(item.contractName, selectedContracts)) {
      jobs.add(item.jobTitle);
    }

    if (item.jobTitle && isSameValue(item.jobTitle, selectedJobs)) {
      contracts.add(item.contractName);
    }

    if (selectedContracts.length === 0) {
      contracts.add(item.contractName);
    }

    if (selectedJobs.length === 0) {
      jobs.add(item.jobTitle);
    }
  });

  return {
    contracts: [...contracts].filter(Boolean).sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" })),
    jobs: [...jobs].filter(Boolean).sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }))
  };
}

function groupCounts(items: string[]): BiLabelValueDatum[] {
  const counters = new Map<string, number>();

  items.forEach((item) => {
    if (!item.trim()) {
      return;
    }

    counters.set(item, (counters.get(item) ?? 0) + 1);
  });

  return [...counters.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "es", { sensitivity: "base" }));
}

function groupVacanciesByContract(items: RecruitmentCaseListRow[]): BiRecruitmentVacancyByContractDatum[] {
  const counters = new Map<string, { requested: number; filled: number }>();

  items.forEach((item) => {
    const current = counters.get(item.contract_name) ?? { requested: 0, filled: 0 };
    current.requested += item.requested_vacancies;
    current.filled += item.filled_vacancies;
    counters.set(item.contract_name, current);
  });

  return [...counters.entries()]
    .map(([label, values]) => ({
      label,
      requested: values.requested,
      filled: values.filled
    }))
    .sort((left, right) => right.requested - left.requested || left.label.localeCompare(right.label, "es", { sensitivity: "base" }));
}

function toMobilityStatusLabel(item: InternalMobilityRequestSummary) {
  if (item.status === "rejected") {
    return "Rechazada";
  }

  if (item.status === "approved" && item.hrExecutionStatus === "executed") {
    return "Ejecutada RRHH";
  }

  if (item.status === "approved") {
    return "Pendiente ejecución RRHH";
  }

  if (item.status === "pending_contracts_control") {
    return "Pendiente control contratos";
  }

  if (item.status === "pending_area_manager") {
    return "Pendiente gerente de área";
  }

  return "Cerrada";
}

function toWeekStart(timestamp: string) {
  const source = new Date(timestamp);
  source.setHours(0, 0, 0, 0);

  const currentDay = (source.getDay() + 6) % 7;
  source.setDate(source.getDate() - currentDay);

  return source.toISOString().slice(0, 10);
}

function formatTimelineLabel(bucketStart: string) {
  const date = new Date(`${bucketStart}T00:00:00`);
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit"
  });
}

function buildTimeline(
  activeCases: RecruitmentCaseListRow[],
  candidateControl: RecruitmentCandidateControlRow[],
  personnelToHire: RecruitmentPersonnelToHireRow[],
  mobility: InternalMobilityRequestSummary[]
): BiRecruitmentOperationalTimelineDatum[] {
  const buckets = new Map<string, BiRecruitmentOperationalTimelineDatum>();

  const ensureBucket = (timestamp: string | null | undefined) => {
    if (!timestamp) {
      return null;
    }

    const bucketStart = toWeekStart(timestamp);
    const current = buckets.get(bucketStart);
    if (current) {
      return current;
    }

    const nextBucket: BiRecruitmentOperationalTimelineDatum = {
      bucketStart,
      bucketLabel: formatTimelineLabel(bucketStart),
      openedFolios: 0,
      readyCandidates: 0,
      hiredCandidates: 0,
      submittedMobilities: 0,
      executedMobilities: 0
    };

    buckets.set(bucketStart, nextBucket);
    return nextBucket;
  };

  activeCases.forEach((item) => {
    const bucket = ensureBucket(item.opened_at);
    if (bucket) {
      bucket.openedFolios += 1;
    }
  });

  candidateControl
    .filter((item) => item.stage_code === "ready_for_hire")
    .forEach((item) => {
      const bucket = ensureBucket(item.stage_entered_at);
      if (bucket) {
        bucket.readyCandidates += 1;
      }
    });

  personnelToHire
    .filter((item) => item.hired_at)
    .forEach((item) => {
      const bucket = ensureBucket(item.hired_at ?? null);
      if (bucket) {
        bucket.hiredCandidates += 1;
      }
    });

  mobility.forEach((item) => {
    const submittedBucket = ensureBucket(item.submittedAt);
    if (submittedBucket) {
      submittedBucket.submittedMobilities += 1;
    }

    if (item.hrExecutionStatus === "executed") {
      const executedBucket = ensureBucket(item.hrExecutionExecutedAt);
      if (executedBucket) {
        executedBucket.executedMobilities += 1;
      }
    }
  });

  return [...buckets.values()].sort((left, right) => left.bucketStart.localeCompare(right.bucketStart));
}

export function useBiRecruitmentOperationalAnalytics(filters?: BiFilters, enabled = true) {
  const dashboardQuery = useQuery({
    queryKey: ["bi", "recruitmentOperational", "dashboard"],
    queryFn: async () => {
      const response = await fetchRecruitmentControlDashboard();
      if (response.error || !response.data) {
        throw new Error(response.error || "No fue posible cargar la operación de reclutamiento.");
      }

      return response.data;
    },
    staleTime: BI_RECRUITMENT_STALE_TIME,
    enabled
  });

  const mobilityQuery = useQuery({
    queryKey: ["bi", "recruitmentOperational", "mobility"],
    queryFn: fetchInternalMobilityRequests,
    staleTime: BI_RECRUITMENT_STALE_TIME,
    enabled
  });

  const data = useMemo<BiRecruitmentOperationalAnalytics | null>(() => {
    if (!dashboardQuery.data || !mobilityQuery.data) {
      return null;
    }

    const periodCode = filters?.periodCode?.trim() || undefined;
    const selectedContracts = filters?.contractCodes?.filter(Boolean) ?? [];
    const selectedJobs = filters?.jobTitles?.filter(Boolean) ?? [];
    const dimensions = buildRecruitmentDimensions(dashboardQuery.data, mobilityQuery.data, periodCode);
    const availableOptions = buildAvailableOptions(dimensions, selectedContracts, selectedJobs);

    const filteredActiveCases = dashboardQuery.data.activeCases.filter(
      (item) =>
        matchesPeriod(item.opened_at, periodCode) &&
        isSameValue(item.contract_name, selectedContracts) &&
        isSameValue(item.job_position_name, selectedJobs)
    );

    const filteredPendingApprovals = dashboardQuery.data.pendingApprovals.filter((item) => {
      const request = item.hiring_requests;
      return (
        !!request &&
        matchesPeriod(item.created_at, periodCode) &&
        isSameValue(request.contract_name, selectedContracts) &&
        isSameValue(request.job_position_name, selectedJobs)
      );
    });

    const filteredCandidateControl = dashboardQuery.data.candidateControl.filter(
      (item) =>
        matchesPeriod(item.stage_entered_at, periodCode) &&
        isSameValue(item.contract_name, selectedContracts) &&
        isSameValue(item.job_position_name, selectedJobs)
    );

    const filteredPersonnelToHire = dashboardQuery.data.personnelToHire.filter(
      (item) =>
        matchesPeriod(item.hired_at ?? item.stage_entered_at, periodCode) &&
        isSameValue(item.contract_name, selectedContracts) &&
        isSameValue(item.job_position_name, selectedJobs)
    );

    const filteredMobility = mobilityQuery.data.filter(
      (item) =>
        matchesPeriod(item.submittedAt, periodCode) &&
        isSameValue(item.destinationAreaName, selectedContracts) &&
        isSameValue(item.destinationJobTitle, selectedJobs)
    );

    const approvalHours = filteredMobility
      .map((item) => diffHours(item.submittedAt, item.approvedAt))
      .filter((value): value is number => value != null);

    const executionHours = filteredMobility
      .map((item) => diffHours(item.approvedAt, item.hrExecutionExecutedAt))
      .filter((value): value is number => value != null);

    return {
      availableContracts: availableOptions.contracts,
      availableJobTitles: availableOptions.jobs,
      summary: {
        openFolios: new Set(filteredActiveCases.map((item) => item.folio || item.case_code)).size,
        openCases: filteredActiveCases.length,
        requestedVacancies: sum(filteredActiveCases.map((item) => item.requested_vacancies)),
        filledVacancies: sum(filteredActiveCases.map((item) => item.filled_vacancies)),
        candidatesInProgress: filteredCandidateControl.filter((item) =>
          CANDIDATE_STAGES_IN_PROGRESS.has(item.stage_code)
        ).length,
        readyCandidates: filteredCandidateControl.filter((item) => item.stage_code === "ready_for_hire").length,
        pendingApprovals: filteredPendingApprovals.length,
        mobilityRequests: filteredMobility.length,
        mobilityPendingExecution: filteredMobility.filter(
          (item) => item.status === "approved" && item.hrExecutionStatus === "pending"
        ).length,
        mobilityExecuted: filteredMobility.filter(
          (item) => item.status === "approved" && item.hrExecutionStatus === "executed"
        ).length,
        avgMobilityApprovalHours: average(approvalHours),
        avgMobilityExecutionHours: average(executionHours)
      },
      casesByStatus: groupCounts(
        filteredActiveCases.map((item) => toRecruitmentCaseStatusLabel(item.status))
      ),
      candidatesByStage: groupCounts(
        filteredCandidateControl.map((item) => toRecruitmentCandidateStageLabel(item.stage_code))
      ),
      vacanciesByContract: groupVacanciesByContract(filteredActiveCases),
      mobilityByStatus: groupCounts(filteredMobility.map(toMobilityStatusLabel)),
      timeline: buildTimeline(
        filteredActiveCases,
        filteredCandidateControl,
        filteredPersonnelToHire,
        filteredMobility
      )
    };
  }, [dashboardQuery.data, filters?.contractCodes, filters?.jobTitles, filters?.periodCode, mobilityQuery.data]);

  return {
    data,
    isLoading: enabled && (dashboardQuery.isLoading || mobilityQuery.isLoading),
    isError: dashboardQuery.isError || mobilityQuery.isError,
    error: dashboardQuery.error ?? mobilityQuery.error
  };
}
