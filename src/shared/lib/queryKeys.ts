export const queryKeys = {
  dashboard: {
    home: (userId: string) => ["dashboard-home", userId] as const
  },
  recruitment: {
    controlDashboard: () => ["recruitment", "control-dashboard"] as const,
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
    requestsRoot: () => ["incentives", "requests"] as const,
    requests: (filters: Record<string, unknown>) => ["incentives", "requests", filters] as const,
    analyticsRoot: () => ["incentives", "analytics"] as const,
    analytics: (filters: Record<string, unknown>) => ["incentives", "analytics", filters] as const,
    approvalsRoot: () => ["incentives", "approvals"] as const,
    approvalsQueue: () => ["incentives", "approvals", "queue"] as const,
    requestDetail: (requestId: string) => ["incentives", "request-detail", requestId] as const,
    workerSearch: (search: string) => ["incentives", "worker-search", search] as const,
    workerContext: (bukEmployeeId: string) =>
      ["incentives", "worker-context", bukEmployeeId] as const,
    rosterSnapshot: (params: Record<string, unknown>) =>
      ["incentives", "roster-snapshot", params] as const,
    preview: (params: Record<string, unknown>) => ["incentives", "preview", params] as const
  },
  roster: {
    setupCatalogs: () => ["roster", "setup-catalogs"] as const,
    workerSearch: (search: string) => ["roster", "worker-search", search] as const,
    workerSchedule: (params: Record<string, unknown>) => ["roster", "worker-schedule", params] as const,
    assignmentsRoot: () => ["roster", "assignments"] as const
  }
};
