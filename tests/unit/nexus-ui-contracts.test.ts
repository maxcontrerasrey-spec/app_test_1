import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Nexus UI contracts", () => {
  it("keeps JM exclusively on login and uses Nexus in the application shell", () => {
    const login = readSource("src/modules/auth/pages/LoginPage.tsx");
    const shell = readSource("src/app/layout/AppShell.tsx");
    const styles = readSource("src/styles/global.css");

    expect(login).toContain('import jmLogo from "../../../assets/app-logo.png"');
    expect(login).toContain('alt="Logo JM"');
    expect(login).not.toContain("nexus-mark.png");
    expect(shell).toContain('import nexusMark from "../../assets/nexus-mark.png"');
    expect(shell).toContain('alt="Logo Nexus"');
    expect(styles).toContain('content: "Nexus\\A Plataforma de gestión y procesos";');
    expect(styles).not.toContain("Personas · Procesos · Innovación");
  });

  it("offsets only the desktop greeting copy beyond the widget axis", () => {
    const styles = readSource("src/modules/dashboard/styles/dashboard.css");

    expect(styles).toContain("@media (min-width: 721px)");
    expect(styles).toContain(".dashboard-hero-copy");
    expect(styles).toContain("padding-inline-start: 0.75rem;");
  });

  it("stacks pending tasks, request tracking and active folios in that order", () => {
    const grid = readSource("src/modules/dashboard/components/DashboardGrid.tsx");
    const styles = readSource("src/modules/dashboard/styles/dashboard.css");
    const tasksIndex = grid.indexOf("dashboard-zone-tasks");
    const requestsIndex = grid.indexOf("dashboard-zone-approvals");
    const foliosIndex = grid.indexOf("dashboard-zone-folios");

    expect(tasksIndex).toBeGreaterThan(-1);
    expect(requestsIndex).toBeGreaterThan(tasksIndex);
    expect(foliosIndex).toBeGreaterThan(requestsIndex);
    expect(grid).toContain('title="Seguimiento de solicitudes"');
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr);");
  });

  it("preserves one-line hiring identifiers and grouped candidate counters", () => {
    const view = readSource("src/modules/recruitment/components/HiringProcessesView.tsx");
    const folios = readSource("src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx");
    const styles = readSource("src/styles/global.css");

    expect(view).toContain("recruitment-processes-table hiring-processes-table");
    expect(folios).toContain("recruitment-processes-table dashboard-folios-table");
    expect(view.match(/candidate-count-item/g)).toHaveLength(3);
    expect(folios.match(/candidate-count-item/g)).toHaveLength(3);
    expect(styles).toContain(".recruitment-processes-table .candidate-count-item");
    expect(styles).toContain("white-space: nowrap !important;");
    expect(styles).toContain(".recruitment-processes-table .candidate-count-indicator");
    expect(view).toContain('{ column: "opened_at", label: "Abierto" }');
    expect(folios).toContain('{ key: "opened_at", label: "Abierto" }');
    expect(folios).toContain('{ key: "contract_name", label: "Contrato" }');
    expect(folios).not.toContain('label: "Contrato / CC"');
  });

  it("uses three top widgets and places the hiring request summary below the form", () => {
    const cards = readSource("src/modules/dashboard/components/DashboardInfoCards.tsx");
    const request = readSource("src/modules/recruitment/pages/HiringRequestPage.tsx");
    const globalStyles = readSource("src/styles/global.css");
    const dashboardStyles = readSource("src/modules/dashboard/styles/dashboard.css");

    expect(cards).not.toContain("DashboardEconomicCard");
    expect(cards.match(/<Dashboard[A-Z][A-Za-z]+Card/g)).toHaveLength(3);
    expect(dashboardStyles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(request).toContain('className="hiring-layout-grid hiring-request-layout"');
    expect(request).toContain("mobility-summary-card hiring-request-summary-card");
    expect(globalStyles).toContain(".hiring-request-summary-grid");
  });

  it("persists the collapsed workspace under the Nexus namespace", () => {
    const shell = readSource("src/app/layout/AppShell.tsx");
    const styles = readSource("src/styles/global.css");

    expect(shell).toContain('localStorage.getItem("nexus-sidebar-collapsed")');
    expect(shell).toContain('localStorage.setItem("nexus-sidebar-collapsed"');
    expect(styles).toContain(".app-shell-topnav.app-shell-sidebar-collapsed .main-content");
    expect(styles).toContain("--collapsed-content-gap: 0.75rem;");
    expect(styles).toContain("padding-left: calc(var(--collapsed-rail-width) + var(--collapsed-content-gap));");
  });

  it("renders Home followed only by authorized submodules in the collapsed rail", () => {
    const shell = readSource("src/app/layout/AppShell.tsx");
    const rail = readSource("src/app/layout/CollapsedNavigationRail.tsx");
    const styles = readSource("src/styles/global.css");

    expect(shell).toContain("<CollapsedNavigationRail");
    expect(shell).toContain("modules={visibleModules}");
    expect(rail).toContain('className="sidebar-icon-rail"');
    expect(rail).toContain('aria-label="Navegación compacta"');
    expect(rail).toContain("homeNavigationItem");
    expect(rail).toContain("to={homeNavigationItem.to}");
    expect(rail).toContain("aria-label={homeNavigationItem.label}");
    expect(rail).toContain("<CollapsedNavigationItems items={module.items} />");
    expect(rail).not.toContain("sidebar-icon-rail-module");
    expect(rail).not.toContain("<button");
    expect(styles).toContain("--collapsed-rail-width: clamp(1.5rem, 2.2vw, 3.25rem);");
    expect(styles).toContain("--collapsed-content-gap: 0.75rem;");
    expect(styles).toContain("width: var(--collapsed-rail-width);");
    expect(styles).toContain(".sidebar-icon-rail-group");
    expect(styles).toContain(".sidebar-icon-rail-link-active");
    expect(styles).toContain(".sidebar-icon-rail-link:hover");
    expect(styles).toContain("transform: scale(1.18);");
    expect(styles).toContain(".sidebar-icon-rail-item-wrap:is(");
    expect(styles).toContain(":has(+ .sidebar-icon-rail-item-wrap > .sidebar-icon-rail-link:hover)");
    expect(styles).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(styles).not.toContain(".sidebar-icon-rail-module");
  });

  it("keeps request tracking without a local search filter", () => {
    const approvals = readSource("src/modules/dashboard/components/widgets/ApprovalTrackingWidget.tsx");

    expect(approvals).not.toContain("dashboard-approval-tracking-search");
    expect(approvals).not.toContain("Folio, cargo, contrato o aprobador");
    expect(approvals).not.toContain("searchTerm");
    expect(approvals).not.toContain("filteredApprovals");
    expect(approvals).toContain("No hay aprobaciones en curso.");
  });

  it("keeps the final Nexus layer theme-aware after the legacy cascade", () => {
    const styles = readSource("src/styles/global.css");
    const nexusLayer = styles.lastIndexOf("/* Nexus visual system:");
    const nexusStyles = styles.slice(nexusLayer);

    expect(nexusLayer).toBeGreaterThan(-1);
    expect(nexusStyles).toContain(':root:not([data-theme="e-ink"])');
    expect(nexusStyles).toContain(':root[data-theme="light"]');
    expect(nexusStyles).toContain("background: var(--top-shell-bg);");
    expect(nexusStyles).toContain("background: var(--surface-card);");
    expect(nexusStyles).toContain("background: var(--sidebar-surface);");
    expect(styles).toContain("background: var(--surface-float);");
    expect(styles).not.toContain("background: rgba(255, 255, 255, 0.98);");
    expect(styles).not.toContain("background: #f4f4f5;");
    expect(styles).toContain("--color-primary: #9b8ced;");
    expect(styles).toContain('[data-theme="dark"] a:not([class])');
  });
});
