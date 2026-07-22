import type { HrIncentiveRequest } from "../types";

export const STATUS_FILTER_OPTIONS = [
  { value: "A", label: "Todos" },
  { value: "P", label: "Pendiente administrador contrato" },
  { value: "E", label: "Pendiente gerente de area" },
  { value: "R", label: "Rechazado" },
  { value: "F", label: "Aprobado" },
  { value: "C", label: "Anulado" }
];

export function getIncentiveStatusLabel(status: HrIncentiveRequest["status"]) {
  switch (status) {
    case "P":
      return "Pendiente administrador contrato";
    case "E":
      return "Pendiente gerente de area";
    case "R":
      return "Rechazado";
    case "F":
      return "Aprobado";
    case "C":
      return "Anulado";
    default:
      return status;
  }
}

function buildIncentiveExportRows(requests: HrIncentiveRequest[]) {
  const parseExcelDate = (value: string | null | undefined) => {
    if (!value?.trim()) {
      return null;
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return null;
    }

    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  };

  const parseExcelDateTime = (value: string | null | undefined) => {
    if (!value?.trim()) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  return requests.map((request) => ({
    folio: request.folio,
    estado_codigo: request.status,
    estado: getIncentiveStatusLabel(request.status),
    periodo: request.periodCode,
    fecha_servicio: parseExcelDate(request.serviceDate),
    fecha_creacion: parseExcelDateTime(request.createdAt),
    fecha_actualizacion: parseExcelDateTime(request.updatedAt),
    fecha_anulacion: parseExcelDateTime(request.cancelledAt),
    desfase_dias_ingreso: request.entryLagDays,
    fuera_de_plazo: request.isOutOfDeadline ? "Si" : "No",
    contrato_distinto: request.isContractMismatch ? "Si" : "No",
    declarado_en_descanso: request.declaredRestDay === null ? "" : request.declaredRestDay ? "Si" : "No",
    rut_empleado: request.employeeDocumentNumber,
    trabajador: request.employeeFullName,
    cargo_empleado: request.employeeJobTitle,
    sindicato_empleado: request.employeeUnionName ?? "",
    area_primaria: request.primaryAreaName ?? "",
    area_servicio: request.selectedAreaName,
    incentivo_tipo: request.incentiveTypeName,
    requiere_reemplazo: request.requiresReplacement ? "Si" : "No",
    rut_reemplazo: request.replacementDocumentNumber ?? "",
    trabajador_reemplazado: request.replacementFullName ?? "",
    motivo: request.motive ?? "",
    descripcion: request.description ?? "",
    origen_monto: request.amountSource === "manual" ? "Manual" : "Regla",
    monto_manual: request.manualAmount ?? "",
    monto_regla: request.rateRuleAmount,
    monto_calculado: request.calculatedAmount,
    duracion_horas: request.durationHours ?? "",
    solicito: request.requesterName,
    email_solicitante: request.requesterEmail ?? "",
    flujo_actual: request.currentFlowUser ?? "",
    cancelado_por_usuario_id: request.cancelledBy ?? "",
    comentario_anulacion: request.cancellationComment ?? ""
  }));
}

export async function exportIncentiveRequestsToXlsx(params: {
  requests: HrIncentiveRequest[];
  mode: "seleccionados" | "periodo";
  periodCode?: string;
}) {
  const { utils, writeFile } = await import("@mylinkpi/xlsx");
  const workbook = utils.book_new();
  const rows = buildIncentiveExportRows(params.requests);
  const worksheet = utils.json_to_sheet(rows, { cellDates: true });

  const dateOnlyColumns = new Set(["fecha_servicio"]);
  const dateTimeColumns = new Set(["fecha_creacion", "fecha_actualizacion", "fecha_anulacion"]);
  const headers = Object.keys(rows[0] ?? {});

  headers.forEach((header, columnIndex) => {
    const isDateOnlyColumn = dateOnlyColumns.has(header);
    const isDateTimeColumn = dateTimeColumns.has(header);

    if (!isDateOnlyColumn && !isDateTimeColumn) {
      return;
    }

    const columnRef = utils.encode_col(columnIndex);

    rows.forEach((_, rowIndex) => {
      const cellRef = `${columnRef}${rowIndex + 2}`;
      const cell = worksheet[cellRef];

      if (!cell || !(cell.v instanceof Date)) {
        return;
      }

      cell.t = "d";
      cell.z = isDateOnlyColumn ? "dd-mm-yyyy" : "dd-mm-yyyy hh:mm";
    });
  });

  utils.book_append_sheet(workbook, worksheet, "Incentivos");

  const safePeriod = params.periodCode?.trim() ? `-${params.periodCode.trim()}` : "";
  const fileName = `incentivos-${params.mode}${safePeriod}.xlsx`;
  writeFile(workbook, fileName, { cellDates: true });
}
