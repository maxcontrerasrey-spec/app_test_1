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

    expect(page).toContain("useBiHeadcountByContract(\n    dotacionFilters,");
    expect(page).toContain("useBiHeadcountByJobTitle(\n    dotacionFilters,");
  });

  it("renders dotacion by gerencia from the protected BI dimension", () => {
    const chart = read("src/modules/bi/components/BiHeadcountCharts.tsx");
    const api = read("src/modules/bi/services/biApi.ts");
    const migration = read("supabase/migrations/20260819233000_add_bi_headcount_by_management.sql");

    expect(chart).toContain("useBiHeadcountByManagement");
    expect(chart).toContain("Dotación por Gerencia");
    expect(chart).toContain('type: "bar"');
    expect(chart).toContain("width: 420");
    expect(chart).toContain('overflow: "break"');
    expect(chart).not.toContain('overflow: "truncate"');
    expect(api).toContain('get_bi_headcount_by_management');
    expect(migration).toContain("buk_area_name_normalized");
    expect(migration).toContain("user_can_access_bi_analytics");
  });

  it("renders the map from canonical regional headcount, never city fallback", () => {
    const chart = read("src/modules/bi/components/BiHeadcountCharts.tsx");
    const api = read("src/modules/bi/services/biApi.ts");
    const migration = read("supabase/migrations/20260820000000_add_bi_headcount_by_region.sql");

    expect(chart).toContain("useBiHeadcountByRegion");
    expect(chart).toContain("Dotación por Región");
    expect(chart).toContain('item.regionName !== "SIN REGION"');
    expect(chart).not.toContain("item.regionName || item.cityName");
    expect(chart).toContain('toLocaleString("es-CL")');
    expect(chart).toContain('"#eff6ff"');
    expect(chart).toContain('text: ["Alta", "Baja"]');
    expect(api).toContain('get_bi_headcount_by_region');
    expect(migration).toContain("normalize_bi_region_name");
    expect(migration).toContain("user_can_access_bi_analytics");
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

});
