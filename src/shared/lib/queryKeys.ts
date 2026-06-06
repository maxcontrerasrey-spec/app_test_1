export const queryKeys = {
  dashboard: {
    home: (userId: string) => ["dashboard-home", userId] as const
  },
  recruitment: {
    controlDashboard: () => ["recruitment", "control-dashboard"] as const,
    caseDetail: (caseId: string) => ["recruitment", "case-detail", caseId] as const,
    hiringCatalogs: () => ["recruitment", "hiring-catalogs"] as const
  }
};
