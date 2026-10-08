import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261008154901_hiring_request_accommodation_and_travel_allowance.sql",
  "utf8"
);
const requestPage = readFileSync("src/modules/recruitment/pages/HiringRequestPage.tsx", "utf8");
const approvalModal = readFileSync("src/modules/recruitment/components/ApprovalModal.tsx", "utf8");
const processView = readFileSync("src/modules/recruitment/components/HiringProcessesView.tsx", "utf8");
const tasksWidget = readFileSync("src/modules/dashboard/components/widgets/TasksWidget.tsx", "utf8");
const trackingWidget = readFileSync("src/modules/dashboard/components/widgets/ApprovalTrackingWidget.tsx", "utf8");
const summary = readFileSync("src/modules/recruitment/components/HiringCompensationSummary.tsx", "utf8");
const styles = readFileSync("src/styles/global.css", "utf8");

describe("hiring folio accommodation, travel allowance, and benefit visibility", () => {
  it("requires a valid accommodation subtype only when accommodation is requested", () => {
    expect(requestPage).toContain('(campamento !== "Si" || Boolean(tipoAlojamiento))');
    expect(requestPage).toContain('campamento === "Si" ?');
    expect(migration).toContain("'pension', 'mining_camp'");
    expect(migration).toContain("p_accommodation_type text");
    expect(migration).toContain("submit_hiring_request(");
    expect(migration).toContain("jsonb_build_object('accommodation_type', p_accommodation_type)");
  });

  it("requires a positive integer allowance at contracts-control approval and records it atomically", () => {
    expect(approvalModal).toContain("Ingresa un monto de bono de traslado mayor a cero.");
    expect(approvalModal).toContain("? Number(travelAllowanceAmount)");
    expect(approvalModal).toContain("travelAllowanceAmount:");
    expect(migration).toContain("p_travel_allowance_amount numeric");
    expect(migration).toContain("normalized_travel_allowance_amount <> trunc(normalized_travel_allowance_amount)");
    expect(migration).toContain("travel_allowance_amount = case");
    expect(migration).toContain("to authenticated;");
  });

  it("redacts free-text benefits outside pending approvals and removes them after approval", () => {
    expect(migration).toContain("'other_benefits', null");
    expect(migration).toContain("hra.status = 'pending'");
    expect(migration).toContain("hra.approver_user_id = auth.uid()");
    expect(processView).not.toContain("Otros beneficios");
    expect(trackingWidget).not.toContain("Otros beneficios");
    expect(tasksWidget).toContain('task.module_code === "solicitud_contrataciones"');
    expect(tasksWidget).toContain('task.status_code === "pending"');
  });

  it("keeps the recruiting summary compact and displays structured fields", () => {
    expect(processView).toContain("<HiringCompensationSummary");
    expect(summary).toContain("Sí · Campamento Minero");
    expect(summary).toContain("Bono de traslado");
    expect(styles).toContain(".hiring-processes-table .expanded-detail-section");
  });
});
