import { describe, expect, it } from "vitest";
import {
  buildDashboardSummary,
  buildDriverDirectory,
  buildEquipmentDirectory,
  buildSimplifiedBukNameSearchKey,
  enumerateDateRange,
  matchesSchedule
} from "../../src/modules/operaciones/lib/transformers";

describe("operations transformers", () => {
  it("simplifica busqueda BUK usando primer nombre y apellidos", () => {
    expect(buildSimplifiedBukNameSearchKey("José Ignacio Pérez Soto")).toBe("jose perez soto");
  });

  it("evalua pautas por dia y limita rangos imposibles", () => {
    expect(matchesSchedule("lunes a viernes", new Date(2026, 6, 20))).toBe(true);
    expect(matchesSchedule("lunes a viernes", new Date(2026, 6, 19))).toBe(false);
    expect(enumerateDateRange("2026-07-20", "2026-07-22")).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22"
    ]);
    expect(enumerateDateRange("2026-07-22", "2026-07-20")).toEqual([]);
  });

  it("deduplica conductores privilegiando activo y datos completos", () => {
    const drivers = buildDriverDirectory([
      {
        buk_employee_id: "1",
        full_name: "Ana Perez Soto",
        document_number: "11.111.111-1",
        document_type: null,
        area_name: "",
        area_code: "",
        is_active: false,
        status: null,
        updated_at: null
      },
      {
        buk_employee_id: "2",
        full_name: "Ana Pérez Soto",
        document_number: "11.111.111-1",
        document_type: null,
        area_name: "SERVICIO CODELCO DMH",
        area_code: "10114",
        is_active: true,
        status: null,
        updated_at: null
      }
    ]);

    expect(drivers).toHaveLength(1);
    expect(drivers[0]).toMatchObject({
      id: "2",
      documentNumber: "11.111.111-1",
      isActive: true
    });
  });

  it("deduplica equipos por codigo privilegiando registros activos completos", () => {
    const equipment = buildEquipmentDirectory([
      {
        equipment_code: " BUS-1 ",
        plate: null,
        equipment_type: null,
        current_client: null,
        brand: null,
        model: null,
        year: null,
        is_active: false,
        updated_at: null
      },
      {
        equipment_code: "BUS-1",
        plate: "ABCD12",
        equipment_type: "Bus",
        current_client: "DMH",
        brand: "Volvo",
        model: "B9",
        year: 2022,
        is_active: true,
        updated_at: null
      }
    ]);

    expect(equipment).toHaveLength(1);
    expect(equipment[0]).toMatchObject({
      code: "BUS-1",
      plate: "ABCD12",
      isActive: true
    });
  });

  it("resume cumplimiento por contrato sin mezclar servicios de otros contratos", () => {
    const summary = buildDashboardSummary({
      contracts: ["CONT-028", "CONT-029"],
      selectedContract: "CONT-028",
      dateRangeValues: ["2026-07-20", "2026-07-21"],
      servicesData: [
        {
          id: 1,
          externalKey: 1,
          operationalName: "Traslado DMH",
          companyName: "Buses JM",
          serviceType: "Base",
          contractualName: "Traslado",
          contractualCategory: "Base",
          scheduleLabel: "Lunes a viernes",
          contract: "CONT-028",
          normalizedSchedule: "lunes a viernes"
        },
        {
          id: 2,
          externalKey: 2,
          operationalName: "Traslado DRT",
          companyName: "Buses JM",
          serviceType: "Base",
          contractualName: "Traslado",
          contractualCategory: "Base",
          scheduleLabel: "Lunes a viernes",
          contract: "CONT-029",
          normalizedSchedule: "lunes a viernes"
        }
      ],
      entries: [
        {
          contract_code: "CONT-028",
          service_date: "2026-07-20",
          shift: "am",
          driver_name: "Ana Perez",
          driver_shift_status: "en_turno",
          service_operational_name: "Traslado DMH",
          service_execution_status: "planned",
          service_execution_note: null,
          equipment_code: "BUS-1",
          equipment_plate: "ABCD12",
          equipment_type: "Bus"
        }
      ]
    });

    expect(summary.totalExpected).toBe(2);
    expect(summary.totalPlanned).toBe(1);
    expect(summary.totalInTurn).toBe(1);
    expect(summary.byContract).toHaveLength(1);
  });
});
