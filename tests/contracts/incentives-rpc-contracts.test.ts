import { describe, expect, it } from "vitest";
import {
  mapApprovalQueueRow,
  mapPreview,
  mapRequestDetail,
  mapSetupCatalogs
} from "../../src/modules/incentives/services/incentivesApiMappers";

describe("incentives RPC contracts", () => {
  it("mapea setup catalogs desde snake_case y conserva flags de reglas manuales/hora", () => {
    const catalogs = mapSetupCatalogs({
      buk_job_titles: ["CONDUCTOR DE BUS", ""],
      buk_union_statuses: [{ value: "unionized", label: "Sindicalizado" }],
      contract_options: [{ value: "CONT-028", label: "CODELCO DMH" }],
      allowed_job_titles: [{ id: "1", job_title: "CONDUCTOR", is_active: true, created_at: "2026-07-22" }],
      incentive_types: [
        {
          id: "type-1",
          code: "extra_shift",
          name: "Turno extra",
          calculation_basis: "per_hour",
          hour_rate_strategy: "buk_overtime",
          requires_replacement: true,
          requires_rest_day: true,
          allows_manual_amount: true,
          is_active: true,
          created_at: "2026-07-22"
        }
      ],
      rate_rules: [
        {
          id: "rule-1",
          incentive_type_id: "type-1",
          incentive_type_name: "Turno extra",
          amount: "10000",
          fallback_base_salary: "900000",
          fallback_weekly_hours: "44",
          overtime_multiplier: "1.5",
          priority: 10,
          is_active: true,
          created_at: "2026-07-22"
        }
      ]
    });

    expect(catalogs.bukJobTitles).toEqual(["CONDUCTOR DE BUS"]);
    expect(catalogs.incentiveTypes[0]).toMatchObject({
      calculationBasis: "per_hour",
      hourRateStrategy: "buk_overtime",
      allowsManualAmount: true
    });
    expect(catalogs.rateRules[0]).toMatchObject({
      fallbackBaseSalary: 900000,
      fallbackWeeklyHours: 44,
      overtimeMultiplier: 1.5
    });
  });

  it("mapea preview con bloqueos de descanso existente y monto manual", () => {
    const preview = mapPreview({
      worker: {
        buk_employee_id: "40022",
        full_name: "Trabajador Uno",
        document_number: "11.111.111-1",
        job_title: "CONDUCTOR",
        union_status: "unionized"
      },
      rule: {
        rate_rule_id: "rule-1",
        incentive_type_id: "type-1",
        incentive_type_name: "Turno extra",
        calculation_basis: "fixed",
        allows_manual_amount: true
      },
      duration_hours: null,
      service_date: "2026-07-22",
      selected_contract_code: "CONT-028",
      amount_source: "manual",
      manual_amount: "45000",
      calculated_amount: "45000",
      roster_validation: {
        requires_rest_day: true,
        base_status: "resting",
        blocked_by_existing_rest_day_incentive: true,
        existing_rest_day_folio: "123",
        block_reason: "Ya existe incentivo para descanso"
      }
    });

    expect(preview.amountSource).toBe("manual");
    expect(preview.manualAmount).toBe(45000);
    expect(preview.calculatedAmount).toBe(45000);
    expect(preview.rosterValidation).toMatchObject({
      requiresRestDay: true,
      baseStatus: "resting",
      blockedByExistingRestDayIncentive: true,
      existingRestDayFolio: 123,
      blockReason: "Ya existe incentivo para descanso"
    });
  });

  it("falla rapido si una fila critica de aprobacion pierde campos obligatorios", () => {
    expect(() =>
      mapApprovalQueueRow({
        approval_id: 1,
        request_id: "req-1",
        folio: 10,
        step_code: "area_manager",
        approval_status: "pending",
        selected_contract_code: "CONT-028",
        incentive_type_name: "Turno extra",
        service_date: "2026-07-22",
        calculated_amount: 10000,
        created_at: "2026-07-22"
      })
    ).toThrow("employee_full_name");
  });

  it("mapea detalle de solicitud con historial y aprobaciones desde contrato RPC", () => {
    const detail = mapRequestDetail({
      request: {
        id: "req-1",
        folio: 10,
        status: "P",
        employee_full_name: "Trabajador Uno",
        selected_contract_code: "CONT-028",
        incentive_type_name: "Turno extra",
        service_date: "2026-07-22",
        calculated_amount: "10000",
        created_at: "2026-07-22",
        updated_at: "2026-07-22"
      },
      approvals: [
        {
          id: 1,
          step_code: "area_manager",
          status: "pending",
          created_at: "2026-07-22"
        }
      ],
      history: [
        {
          id: 1,
          action_type: "created",
          metadata: { source: "test" },
          created_at: "2026-07-22"
        }
      ]
    });

    expect(detail.request.employeeFullName).toBe("Trabajador Uno");
    expect(detail.request.calculatedAmount).toBe(10000);
    expect(detail.approvals).toHaveLength(1);
    expect(detail.history[0].metadata).toEqual({ source: "test" });
  });
});
