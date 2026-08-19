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

  it("uses document navigation for top-level module switches", () => {
    const shell = read("src/app/layout/AppShell.tsx");
    const biPage = read("src/modules/bi/pages/BiDashboardPage.tsx");

    expect(shell.match(/reloadDocument/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(shell).toContain("top-nav-dropdown-link");
    expect(shell).toContain("top-nav-link top-nav-link-active");
    expect(biPage).not.toContain("reloadDocument");
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
});
