import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const widget = readFileSync(
  "src/modules/dashboard/components/widgets/TasksWidget.tsx",
  "utf8"
);
const hook = readFileSync(
  "src/modules/internal_mobility/hooks/useInternalMobilityQueries.ts",
  "utf8"
);
const styles = readFileSync("src/styles/global.css", "utf8");

describe("dashboard mobility approval destination folio", () => {
  it("loads visible mobility requests only when the approval task list needs them", () => {
    expect(widget).toContain("const hasMobilityTasks = tasks.some((task) => task.module_code === \"movilidad_interna\")");
    expect(widget).toContain("useInternalMobilityRequests(hasMobilityTasks)");
    expect(widget).toContain("mobilityRequestsByFolio.get(task.folio ?? \"\")");
    expect(hook).toContain("export function useInternalMobilityRequests(enabled = true)");
    expect(hook).toContain("enabled,");
  });

  it("shows the destination folio and keeps mobility details compact", () => {
    expect(widget).toContain("Destino {mobilityRequest.destinationFolio}");
    expect(widget).toContain("<small>Folio destino</small>");
    expect(widget).toContain("<small>Caso destino</small>");
    expect(widget).toContain("mobility-task-detail-grid");
    expect(styles).toContain(".mobility-task-detail-grid .expanded-detail-section");
    expect(styles).toContain(".dashboard-task-destination-folio");
  });
});
