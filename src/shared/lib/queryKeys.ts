export const queryKeys = {
  dashboard: {
    home: (userId: string) => ["dashboard-home", userId] as const
  },
  recruitment: {
    controlDashboard: () => ["recruitment", "control-dashboard"] as const,
    caseDetail: (caseId: string) => ["recruitment", "case-detail", caseId] as const,
    hiringCatalogs: () => ["recruitment", "hiring-catalogs"] as const
  },
  incentives: {
    setupCatalogs: () => ["incentives", "setup-catalogs"] as const,
    requestsRoot: () => ["incentives", "requests"] as const,
    requests: (filters: Record<string, unknown>) => ["incentives", "requests", filters] as const,
    workerSearch: (search: string) => ["incentives", "worker-search", search] as const,
    workerContext: (bukEmployeeId: string) =>
      ["incentives", "worker-context", bukEmployeeId] as const,
    preview: (params: Record<string, unknown>) => ["incentives", "preview", params] as const
  }
};
