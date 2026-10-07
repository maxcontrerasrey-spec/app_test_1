type BiQueryFilters = {
  periodCode?: string | null;
  contractCodes?: Array<string | null | undefined> | null;
  jobTitles?: Array<string | null | undefined> | null;
  managementNames?: Array<string | null | undefined> | null;
  shiftNames?: Array<string | null | undefined> | null;
};

function normalizeTextArray(values?: Array<string | null | undefined> | null) {
  return [...(values ?? [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .sort();
}

function normalizeBiFilters(filters?: BiQueryFilters | null) {
  return {
    periodCode: filters?.periodCode?.trim() || "",
    contractCodes: normalizeTextArray(filters?.contractCodes),
    jobTitles: normalizeTextArray(filters?.jobTitles),
    managementNames: normalizeTextArray(filters?.managementNames),
    shiftNames: normalizeTextArray(filters?.shiftNames)
  };
}

export const queryKeys = {
  dashboard: {
    home: (userId: string) => ["dashboard-home", userId] as const
  },
  bi: {
    all: () => ["bi"] as const,
    dotacionDashboard: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "dotacionDashboard", normalizeBiFilters(filters)] as const,
    headcountByContract: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "headcountByContract", normalizeBiFilters(filters)] as const,
    headcountByJobTitle: (filters?: BiQueryFilters | null) =>
      [...queryKeys.bi.all(), "headcountByJobTitle", normalizeBiFilters(filters)] as const,
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
    caseDetail: (caseId: string, candidateId?: string) =>
      candidateId
        ? (["recruitment", "case-detail", caseId, candidateId] as const)
        : (["recruitment", "case-detail", caseId] as const),
    hiringCatalogs: () => ["recruitment", "hiring-catalogs"] as const
  },
  psycholaboral: {
    all: () => ["psycholaboral"] as const,
    catalog: () => ["psycholaboral", "catalog"] as const,
    candidates: (filters: Record<string, unknown>) => ["psycholaboral", "candidates", filters] as const,
    summary: (search: string) => ["psycholaboral", "summary", search] as const
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
  rentStructures: {
    position: (contractId: number | null, jobPositionId: number | null) =>
      ["rent-structures", "control", contractId, jobPositionId] as const,
    control: (contractId: number | null, jobPositionId: number | null, shiftId: number | null, structureId: string | null) =>
      ["rent-structures", "control", contractId, jobPositionId, shiftId, structureId] as const
  },
  communications: {
    portal: () => ["communications", "portal"] as const,
    site: () => ["communications", "site"] as const
  },
  sanctions: {
    setupCatalogs: () => ["sanctions", "setup-catalogs"] as const,
    workerSearch: (search: string) => ["sanctions", "worker-search", search] as const,
    requestsRoot: () => ["sanctions", "requests"] as const,
    requestsPage: (filters: Record<string, unknown>) =>
      ["sanctions", "requests", "page", filters] as const,
    requestDetailRoot: () => ["sanctions", "request-detail"] as const,
    requestDetail: (requestId: string) => ["sanctions", "request-detail", requestId] as const
  },
  roster: {
    all: () => ["roster"] as const,
    setupCatalogs: () => ["roster", "setup-catalogs"] as const,
    calendarSummary: (params: Record<string, unknown>) =>
      ["roster", "calendar-summary", params] as const,
    calendarScopeSummary: (params: Record<string, unknown>) =>
      ["roster", "calendar-scope-summary", params] as const,
    bulkCalendar: (params: Record<string, unknown>) =>
      ["roster", "bulk-calendar", params] as const,
    workerSearch: (search: string) => ["roster", "worker-search", search] as const,
    workerSchedule: (params: Record<string, unknown>) => ["roster", "worker-schedule", params] as const,
    assignmentsRoot: () => ["roster", "assignments"] as const
  },
  operations: {
    all: () => ["atlas-operations"] as const,
    catalogs: () => [...queryKeys.operations.all(), "catalogs"] as const,
    adminUsers: () => [...queryKeys.operations.all(), "admin-users"] as const,
    dispatches: (day: string) => [...queryKeys.operations.all(), "dispatches", day] as const,
    vehiclePositions: (vehicleIds: string[]) => [...queryKeys.operations.all(), "vehicle-positions", vehicleIds] as const,
    alerts: (day: string, dispatchIds: string[] = []) => [...queryKeys.operations.all(), "alerts", day, dispatchIds] as const,
    driverDispatches: () => [...queryKeys.operations.all(), "driver-dispatches"] as const,
    serviceRoutes: (serviceTemplateId: number | string) => [...queryKeys.operations.all(), "service-routes", serviceTemplateId] as const,
    events: (dispatchId: string) => [...queryKeys.operations.all(), "events", dispatchId] as const,
    driverSearch: (params: { search: string; day: string }) =>
      [...queryKeys.operations.all(), "driver-search", params] as const,
    driverLookup: (params: { search: string; serviceDate: string }) =>
      queryKeys.operations.driverSearch({ search: params.search, day: params.serviceDate })
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
