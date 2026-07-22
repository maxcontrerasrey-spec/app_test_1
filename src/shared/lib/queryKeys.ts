type BiQueryFilters = {
  periodCode?: string | null;
  contractCodes?: Array<string | null | undefined> | null;
  jobTitles?: Array<string | null | undefined> | null;
  managementNames?: Array<string | null | undefined> | null;
};

function normalizeBiFilters(filters?: BiQueryFilters | null) {
  return {
    periodCode: filters?.periodCode?.trim() || "",
    contractCodes: [...(filters?.contractCodes ?? [])].filter(Boolean).sort(),
    jobTitles: [...(filters?.jobTitles ?? [])].filter(Boolean).sort(),
    managementNames: [...(filters?.managementNames ?? [])].filter(Boolean).sort()
  };
}

export const queryKeys = {
  dashboard: {
    home: (userId: string) => ["dashboard-home", userId] as const
  },
  bi: {
    all: () => ["bi"] as const,
    workforceOverview: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "workforceOverview", normalizeBiFilters(filters)] as const,
    headcountByContract: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "headcountByContract", normalizeBiFilters(filters)] as const,
    headcountByJobTitle: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "headcountByJobTitle", normalizeBiFilters(filters)] as const,
    headcountByCity: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "headcountByCity", normalizeBiFilters(filters)] as const,
    ageDistribution: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "ageDistribution", normalizeBiFilters(filters)] as const,
    exceptionsToday: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "exceptionsToday", normalizeBiFilters(filters)] as const,
    presenceSummaryToday: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "presenceSummaryToday", normalizeBiFilters(filters)] as const,
    exceptionsMonthly: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "exceptionsMonthly", normalizeBiFilters(filters)] as const,
    vacationForecast: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "vacationForecast", normalizeBiFilters(filters)] as const,
    medicalLeaveByArea: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "medicalLeaveByArea", normalizeBiFilters(filters)] as const,
    recruitmentPipeline: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "recruitmentPipeline", normalizeBiFilters(filters)] as const,
    recruitmentDashboard: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "recruitmentDashboard", normalizeBiFilters(filters)] as const
  },
  recruitment: {
    controlSummary: () => ["recruitment", "control-summary"] as const,
    approvalsRoot: () => ["recruitment", "approvals"] as const,
    approvals: (filters: Record<string, unknown>) =>
      ["recruitment", "approvals", filters] as const,
    processesRoot: () => ["recruitment", "processes"] as const,
    processes: (filters: Record<string, unknown>) =>
      ["recruitment", "processes", filters] as const,
    candidatesRoot: () => ["recruitment", "candidates"] as const,
    candidates: (filters: Record<string, unknown>) =>
      ["recruitment", "candidates", filters] as const,
    personnelRoot: () => ["recruitment", "personnel-to-hire"] as const,
    personnel: (filters: Record<string, unknown>) =>
      ["recruitment", "personnel-to-hire", filters] as const,
    contractedPersonnelRoot: () => ["recruitment", "contracted-personnel"] as const,
    contractedPersonnel: (filters: Record<string, unknown>) =>
      ["recruitment", "contracted-personnel", filters] as const,
    activeCaseOptions: (filters: Record<string, unknown>) =>
      ["recruitment", "active-case-options", filters] as const,
    caseDetail: (caseId: string) => ["recruitment", "case-detail", caseId] as const,
    hiringCatalogs: () => ["recruitment", "hiring-catalogs"] as const
  },
  internalMobility: {
    setupCatalogs: () => ["internal-mobility", "setup-catalogs"] as const,
    workerSearch: (search: string) => ["internal-mobility", "worker-search", search] as const,
    workerContext: (bukEmployeeId: string) =>
      ["internal-mobility", "worker-context", bukEmployeeId] as const,
    requestsRoot: () => ["internal-mobility", "requests"] as const,
    requests: () => ["internal-mobility", "requests", "list"] as const,
    requestDetail: (requestId: string) =>
      ["internal-mobility", "request-detail", requestId] as const
  },
  incentives: {
    setupCatalogs: () => ["incentives", "setup-catalogs"] as const,
    eligibleTypesRoot: () => ["incentives", "eligible-types"] as const,
    requestsRoot: () => ["incentives", "requests"] as const,
    requestsList: (filters: Record<string, unknown>) =>
      ["incentives", "requests", "list", filters] as const,
    requestsPage: (filters: Record<string, unknown>) =>
      ["incentives", "requests", "page", filters] as const,
    analyticsRoot: () => ["incentives", "analytics"] as const,
    analytics: (filters: Record<string, unknown>) => ["incentives", "analytics", filters] as const,
    approvalsRoot: () => ["incentives", "approvals"] as const,
    approvalsQueueList: (filters: Record<string, unknown>) =>
      ["incentives", "approvals", "queue", "list", filters] as const,
    approvalsQueuePage: (filters: Record<string, unknown>) =>
      ["incentives", "approvals", "queue", "page", filters] as const,
    requestDetailRoot: () => ["incentives", "request-detail"] as const,
    requestDetail: (requestId: string) => ["incentives", "request-detail", requestId] as const,
    workerSearch: (search: string) => ["incentives", "worker-search", search] as const,
    workerContext: (bukEmployeeId: string) =>
      ["incentives", "worker-context", bukEmployeeId] as const,
    eligibleTypes: (params: Record<string, unknown>) =>
      ["incentives", "eligible-types", params] as const,
    rosterSnapshot: (params: Record<string, unknown>) =>
      ["incentives", "roster-snapshot", params] as const,
    preview: (params: Record<string, unknown>) => ["incentives", "preview", params] as const
  },
  roster: {
    all: () => ["roster"] as const,
    setupCatalogs: () => ["roster", "setup-catalogs"] as const,
    calendarSummary: (params: Record<string, unknown>) =>
      ["roster", "calendar-summary", params] as const,
    workerSearch: (search: string) => ["roster", "worker-search", search] as const,
    workerSchedule: (params: Record<string, unknown>) => ["roster", "worker-schedule", params] as const,
    assignmentsRoot: () => ["roster", "assignments"] as const
  },
  operations: {
    driverSearch: (params: Record<string, unknown>) =>
      ["operations", "driver-search", params] as const
  },
  accreditation: {
    all: () => ["accreditation"] as const,
    setupCatalogs: () => ["accreditation", "setup-catalogs"] as const,
    dashboard: (filters: Record<string, unknown>) => ["accreditation", "dashboard", filters] as const,
    workers: (filters: Record<string, unknown>) => ["accreditation", "workers", filters] as const,
    workerProfile: (bukEmployeeId: string, siteId: string) =>
      ["accreditation", "worker-profile", bukEmployeeId, siteId] as const
  },
  competencies: {
    workerSearch: (search: string) => ["competencies", "worker-search", search] as const
  },
  operationalOnboarding: {
    cases: () => ["operational-onboarding-cases"] as const,
    tasks: () => ["operational-onboarding-tasks"] as const,
    activityLog: () => ["operational-onboarding-activity-log"] as const,
    candidateProfiles: () => ["candidate-profiles-list"] as const,
    templates: () => ["onboarding_templates"] as const,
    templateTasks: (templateId: string) => ["onboarding_template_tasks", templateId] as const
  }
};
