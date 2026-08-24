import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("BI module navigation integrity", () => {
  it("uses route links for BI view switching", () => {
    const page = read("src/modules/bi/pages/BiDashboardPage.tsx");

    expect(page).toContain("import { Navigate, NavLink, useParams } from \"react-router\"");
    expect(page).toContain("to={`/bi/${item.key}`}");
    expect(page).not.toContain("onClick={() => navigate(`/bi/${item.key}`)}");
  });

  it("uses document navigation for BI and top-level module switches", () => {
    const shell = read("src/app/layout/AppShell.tsx");
    const biPage = read("src/modules/bi/pages/BiDashboardPage.tsx");
    const styles = read("src/styles/global.css");

    expect(shell.match(/reloadDocument/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(shell).toContain("top-nav-dropdown-link");
    expect(shell).toContain("top-nav-link top-nav-link-active");
    expect(biPage).toContain("reloadDocument");
    expect(styles).toContain(".top-nav-mobile-panel {");
    expect(styles).toContain("flex-direction: column;");
    expect(styles).toContain("align-items: stretch;");
  });

  it("does not fetch the incentive request list until a concrete period exists", () => {
    const hook = read("src/modules/incentives/hooks/useIncentivesQueries.ts");
    const analytics = read("src/modules/incentives/components/IncentiveAnalyticsView.tsx");

    expect(hook).toContain(
      "export function useHrIncentiveRequests(filters: HrIncentiveRequestsFilters, enabled = true)"
    );
    expect(hook).toContain("enabled");
    expect(analytics).toContain("}, Boolean(actualPeriodCode));");
  });

  it("passes the dotacion period to every headcount query", () => {
    const page = read("src/modules/bi/pages/BiDashboardPage.tsx");

    expect(page).toContain("useBiHeadcountByContract(\n    dotacionOptionFilters,");
    expect(page).toContain("useBiHeadcountByJobTitle(\n    dotacionOptionFilters,");
    expect(page).toContain("<BiHeadcountCharts");
    expect(page).toContain("filters={dotacionFilters}");
  });

  it("keeps the dotacion filter catalog independent from selected dimensions", () => {
    const page = read("src/modules/bi/pages/BiDashboardPage.tsx");

    expect(page).toContain("const dotacionOptionFilters = useMemo<BiFilters>");
    expect(page).toContain("useBiHeadcountByContract(\n    dotacionOptionFilters,");
    expect(page).toContain("useBiHeadcountByJobTitle(\n    dotacionOptionFilters,");
  });

  it("keeps shared multi-select filters open while selecting options", () => {
    const multiSelect = read("src/shared/ui/forms/MultiSelectField.tsx");

    expect(multiSelect).toContain("event.stopPropagation();");
    expect(multiSelect).toContain("toggleOption(opt.value);");
  });

  it("renders dotacion by gerencia from the protected BI dimension", () => {
    const chart = read("src/modules/bi/components/BiHeadcountCharts.tsx");
    const migration = read("supabase/migrations/20260819233000_add_bi_headcount_by_management.sql");

    expect(chart).toContain("useBiDotacionDashboard");
    expect(chart).toContain("Dotación por Gerencia");
    expect(chart).toContain('type: "bar"');
    expect(chart).toContain("width: 300");
    expect(chart).toContain("grid: { left: 0");
    expect(chart).toContain('overflow: "break"');
    expect(chart).not.toContain('overflow: "truncate"');
    expect(migration).toContain("get_bi_headcount_by_management");
    expect(migration).toContain("buk_area_name_normalized");
    expect(migration).toContain("user_can_access_bi_analytics");
  });

  it("propagates gerencia selection across dotacion queries and charts", () => {
    const page = read("src/modules/bi/pages/BiDashboardPage.tsx");
    const chart = read("src/modules/bi/components/BiHeadcountCharts.tsx");
    const api = read("src/modules/bi/services/biApi.ts");

    expect(page).toContain("dotacionManagementSelection");
    expect(page).toContain("managementNames: dotacionManagementSelection ? [dotacionManagementSelection] : []");
    expect(page).toContain("current === managementName ? null : managementName");
    expect(chart).toContain("onManagementSelect");
    expect(chart).toContain("managementChartEvents");
    expect(chart).toContain("Haz clic en una barra para filtrar todo el tablero.");
    expect(api).toContain("p_management_names");
  });

  it("renders ordered regional bars from canonical headcount, never city fallback", () => {
    const chart = read("src/modules/bi/components/BiHeadcountCharts.tsx");
    const migration = read("supabase/migrations/20260820000000_add_bi_headcount_by_region.sql");

    expect(chart).toContain("headcountByRegion");
    expect(chart).toContain("Dotación por Región");
    expect(chart).toContain('item.regionName !== "SIN REGION"');
    expect(chart).not.toContain("item.regionName || item.cityName");
    expect(chart).toContain('toLocaleString("es-CL")');
    expect(chart).toContain("CHILE_REGION_ORDER");
    expect(chart).toContain("formatPercentage");
    expect(chart).toContain("REGION_BAR_COLORS");
    expect(chart).toContain("position: \"top\"");
    expect(migration).toContain("get_bi_headcount_by_region");
    expect(migration).toContain("normalize_bi_region_name");
    expect(migration).toContain("user_can_access_bi_analytics");
  });

  it("consolidates dotacion filter changes into one cached dashboard request", () => {
    const hook = read("src/modules/bi/hooks/useBiQueries.ts");
    const api = read("src/modules/bi/services/biApi.ts");
    const migration = read("supabase/migrations/20260822030431_optimize_bi_dotacion_dashboard_request.sql");

    expect(hook).toContain("useBiDotacionDashboard");
    expect(hook).toContain("placeholderData: (previous) => previous");
    expect(api).toContain('get_bi_dotacion_dashboard');
    expect(hook).not.toContain("useBiWorkforceOverview");
    expect(hook).not.toContain("useBiExceptionsMonthly");
    expect(api).not.toContain("export async function fetchBiWorkforceOverview");
    expect(api).not.toContain("export async function fetchBiExceptionsMonthly");
    expect(migration).toContain("get_bi_dotacion_dashboard");
    expect(migration).toContain("headcountByManagement");
    expect(migration).toContain("grant execute on function public.get_bi_dotacion_dashboard");
  });

  it("keeps dotacion below the one-second rendering budget", () => {
    const page = read("src/modules/bi/pages/BiDashboardPage.tsx");
    const chartSurface = read("src/shared/ui/charts/EChartSurface.tsx");
    const migration = read(
      "supabase/migrations/20260824183000_optimize_bi_dotacion_single_scan.sql"
    );
    const cacheMigration = read(
      "supabase/migrations/20260824193000_cache_bi_current_population.sql"
    );
    const hardeningMigration = read(
      "supabase/migrations/20260824200000_harden_bi_population_cache_access.sql"
    );

    expect(page).not.toContain("useProgressiveBiStage");
    expect(page).not.toContain("dotacionChartStage");
    expect(page).toContain("handleDotacionManagementSelect");
    expect(chartSurface).toContain("animationDuration: 140");
    expect(chartSurface).toContain("animationDurationUpdate: 90");
    expect(migration).toContain("population as materialized");
    expect(migration.match(/get_bi_employee_population\(/g)?.length).toBe(1);
    expect(migration).toContain("idx_hr_roster_exceptions_active_date_employee");
    expect(cacheMigration).toContain("refresh materialized view concurrently");
    expect(cacheMigration).toContain("'* * * * *'");
    expect(hardeningMigration).toContain("cached.area_name = any(normalized_contracts)");
    expect(hardeningMigration).toContain(
      "revoke all on function public.get_bi_employee_population"
    );
    expect(hardeningMigration).not.toContain(
      "grant execute on function public.get_bi_employee_population"
    );
  });

  it("allows the monthly snapshot scheduler without weakening API authorization", () => {
    const migration = read(
      "supabase/migrations/20260819243000_fix_monthly_buk_snapshot_cron_context.sql"
    );

    expect(migration).toContain("request_claims <> ''");
    expect(migration).toContain("capture_buk_employee_monthly_snapshot");
    expect(migration).toContain("Solo se pueden capturar periodos BUK cerrados");
    expect(migration).toContain(
      "grant execute on function public.capture_buk_employee_monthly_snapshot(date) to authenticated, service_role"
    );
    expect(migration).not.toContain("capture_buk_employee_daily_snapshot");
  });

  it("keeps contingency snapshot imports idempotent and auditable", () => {
    const migration = read(
      "supabase/migrations/20260820010000_add_audited_contingency_buk_snapshot_import.sql"
    );

    expect(migration).toContain("buk_employee_snapshot_contingency_audits");
    expect(migration).toContain("source_sha256 text not null");
    expect(migration).toContain("capture_mode in ('scheduled', 'contingency')");
    expect(migration).toContain("where audit.source_sha256 = normalized_sha256");
    expect(migration).toContain("no se sobrescribe historia");
    expect(migration).toContain("grant execute on function public.import_buk_employee_contingency_snapshot");
    expect(migration).toContain("to service_role");
  });

});
