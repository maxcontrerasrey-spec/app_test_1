import { describe, expect, it } from "vitest";
import { validateServiceEntryPayload } from "../../src/modules/operaciones/lib/service-entry";

describe("validateServiceEntryPayload", () => {
  it("preserva identificadores canonicos para servicios planificados", () => {
    const result = validateServiceEntryPayload({
      contractCode: " CONT-028 ",
      shift: "AM",
      serviceDate: "2026-07-22",
      serviceExternalKey: "184",
      serviceExecutionStatus: "planned",
      driverBukEmployeeId: "40022",
      driverName: " Juan  Perez ",
      driverDocument: "11.111.111-1",
      driverArea: "SERVICIO CODELCO DMH",
      equipmentCode: " bus-123 "
    });

    expect(result.isValid).toBe(true);
    expect(result.cleaned).toMatchObject({
      contractCode: "CONT-028",
      shift: "am",
      serviceExternalKey: 184,
      driverBukEmployeeId: "40022",
      driverName: "Juan Perez",
      equipmentCode: "BUS-123"
    });
  });

  it("limpia conductor y equipo cuando el servicio no fue realizado", () => {
    const result = validateServiceEntryPayload({
      contractCode: "CONT-028",
      shift: "pm",
      serviceDate: "2026-07-22",
      serviceExternalKey: 185,
      serviceExecutionStatus: "not_performed",
      driverBukEmployeeId: "40022",
      driverName: "Juan Perez",
      equipmentCode: "BUS-123"
    });

    expect(result.isValid).toBe(true);
    expect(result.cleaned).toMatchObject({
      serviceExecutionNote: "Servicio no realizado",
      driverBukEmployeeId: "",
      driverName: "",
      equipmentCode: ""
    });
  });

  it("rechaza fechas imposibles y servicios sin equipo en planned", () => {
    const result = validateServiceEntryPayload({
      contractCode: "CONT-028",
      shift: "am",
      serviceDate: "2026-02-30",
      serviceExternalKey: 10,
      serviceExecutionStatus: "planned",
      driverBukEmployeeId: "40022",
      driverName: "Juan Perez"
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveProperty("serviceDate");
    expect(result.errors).toHaveProperty("equipmentCode");
  });
});
