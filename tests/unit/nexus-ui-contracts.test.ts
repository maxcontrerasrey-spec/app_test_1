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

    expect(login).toContain('import jmLogo from "../../../assets/app-logo.png"');
    expect(login).toContain('alt="Logo JM"');
    expect(login).not.toContain("nexus-mark.png");
    expect(shell).toContain('import nexusMark from "../../assets/nexus-mark.png"');
    expect(shell).toContain('alt="Logo Nexus"');
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
    const styles = readSource("src/styles/global.css");

    expect(view).toContain('className="tracking-table hiring-processes-table"');
    expect(view.match(/candidate-count-item/g)).toHaveLength(3);
    expect(styles).toContain(".hiring-processes-table .candidate-count-item");
    expect(styles).toContain("white-space: nowrap !important;");
  });

  it("persists the collapsed workspace under the Nexus namespace", () => {
    const shell = readSource("src/app/layout/AppShell.tsx");
    const styles = readSource("src/styles/global.css");

    expect(shell).toContain('localStorage.getItem("nexus-sidebar-collapsed")');
    expect(shell).toContain('localStorage.setItem("nexus-sidebar-collapsed"');
    expect(styles).toContain(".app-shell-topnav.app-shell-sidebar-collapsed .main-content");
    expect(styles).toContain("padding-inline: clamp(1.5rem, 2.2vw, 3.25rem);");
  });
});
