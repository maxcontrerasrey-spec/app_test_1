import { describe, expect, it } from "vitest";
import { validateServiceEntryPayload } from "../../src/modules/operaciones/lib/service-entry";

describe("operations service entry contract", () => {
  it("rechaza payloads que no son objetos para proteger el RPC submit_service_entries_batch", () => {
    const result = validateServiceEntryPayload(null);

    expect(result).toEqual({
      isValid: false,
      errors: {
        payload: "El cuerpo de la planificación no es válido."
      },
      cleaned: null
    });
  });

  it("normaliza el contrato frontend planned requerido por backend", () => {
    const result = validateServiceEntryPayload({
      contractCode: "CONT-028",
      shift: "am",
      serviceDate: "2026-07-22",
      serviceExternalKey: 999,
      driverBukEmployeeId: "buk_40022",
      driverName: "Conductor Operativo",
      driverDocument: "11.111.111-1",
      driverArea: "DMH",
      equipmentCode: "bus 45"
    });

    expect(result.cleaned).toEqual({
      contractCode: "CONT-028",
      shift: "am",
      serviceDate: "2026-07-22",
      serviceExternalKey: 999,
      serviceExecutionStatus: "planned",
      serviceExecutionNote: "",
      driverBukEmployeeId: "buk_40022",
      driverName: "Conductor Operativo",
      driverDocument: "11.111.111-1",
      driverArea: "DMH",
      equipmentCode: "BUS 45"
    });
  });
});
