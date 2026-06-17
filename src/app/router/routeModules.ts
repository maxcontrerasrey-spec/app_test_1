export const routeModuleImporters = {
  homePage: async () => ({
    default: (await import("../../modules/home/pages/HomePage")).HomePage
  }),
  hiringRequestPage: async () => ({
    default: (await import("../../modules/recruitment/pages/HiringRequestPage")).HiringRequestPage
  }),
  internalMobilityPage: async () => ({
    default: (await import("../../modules/internal_mobility/pages/InternalMobilityPage")).InternalMobilityPage
  }),
  hiringStatusPage: async () => ({
    default: (await import("../../modules/recruitment/pages/HiringStatusPage")).HiringStatusPage
  }),
  loginPage: async () => ({
    default: (await import("../../modules/auth/pages/LoginPage")).LoginPage
  }),
  resetPasswordPage: async () => ({
    default: (await import("../../modules/auth/pages/ResetPasswordPage")).ResetPasswordPage
  }),
  accessDeniedPage: async () => ({
    default: (await import("../../modules/auth/pages/AccessDeniedPage")).AccessDeniedPage
  }),
  operacionesDashboard: async () => ({
    default: (await import("../../modules/operaciones/pages/OperacionesDashboard")).OperacionesDashboard
  }),
  humanResourcesDashboard: async () => ({
    default: (
      await import("../../modules/incentives/pages/HumanResourcesDashboard")
    ).HumanResourcesDashboard
  }),
  rosterPage: async () => ({
    default: (await import("../../modules/roster/pages/RosterPage")).RosterPage
  }),
  accreditationPage: async () => ({
    default: (await import("../../modules/accreditation/pages/AccreditationPage")).AccreditationPage
  }),
  aiAssistantHome: async () => ({
    default: (await import("../../modules/ai_assistant/pages/AIAssistantHome")).AIAssistantHome
  }),
  onboardingModuleLayout: async () => ({
    default: (await import("../../modules/operational_onboarding/pages/OnboardingModuleLayout"))
      .OnboardingModuleLayout
  }),
  biDashboard: async () => ({
    default: (await import("../../modules/bi/pages/BiDashboardPage")).BiDashboardPage
  })
} as const;

type RouteModuleKey = keyof typeof routeModuleImporters;

function normalizeRoutePath(path: string) {
  const pathname = path.trim();
  if (!pathname) {
    return "/";
  }

  if (pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function getRouteModuleKeysForPath(path: string): RouteModuleKey[] {
  const normalizedPath = normalizeRoutePath(path);

  if (normalizedPath === "/" || normalizedPath.startsWith("/?")) {
    return ["homePage"];
  }

  if (normalizedPath.startsWith("/solicitud-contrataciones")) {
    return ["hiringRequestPage"];
  }

  if (normalizedPath.startsWith("/movilidad-interna")) {
    return ["internalMobilityPage"];
  }

  if (normalizedPath.startsWith("/control-contrataciones")) {
    return ["hiringStatusPage"];
  }

  if (normalizedPath.startsWith("/alta-operacional")) {
    return ["onboardingModuleLayout"];
  }

  if (normalizedPath.startsWith("/operaciones")) {
    return ["operacionesDashboard"];
  }

  if (normalizedPath.startsWith("/recursos-humanos/acreditacion")) {
    return ["accreditationPage"];
  }

  if (normalizedPath.startsWith("/recursos-humanos")) {
    return ["humanResourcesDashboard"];
  }

  if (normalizedPath.startsWith("/roster")) {
    return ["rosterPage"];
  }

  if (normalizedPath.startsWith("/acreditacion")) {
    return ["accreditationPage"];
  }

  if (normalizedPath.startsWith("/copiloto-ia")) {
    return ["aiAssistantHome"];
  }

  if (normalizedPath.startsWith("/bi")) {
    return ["biDashboard"];
  }

  if (normalizedPath.startsWith("/login")) {
    return ["loginPage"];
  }

  if (normalizedPath.startsWith("/reset-password")) {
    return ["resetPasswordPage"];
  }

  if (normalizedPath.startsWith("/sin-acceso")) {
    return ["accessDeniedPage"];
  }

  return [];
}

export function preloadRouteModulesForPath(path: string) {
  const keys = getRouteModuleKeysForPath(path);
  if (keys.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(keys.map((key) => routeModuleImporters[key]())).then(() => undefined);
}
