import type { InternalMobilityEligibleWorker } from "../types";

export function buildInternalMobilityWorkerRecordLabel(
  worker: InternalMobilityEligibleWorker
) {
  const operationalLabel =
    worker.areaName || worker.contractCode || "Sin área activa";

  if (worker.activeRecordCount <= 1) {
    return operationalLabel;
  }

  return `${operationalLabel} · Ficha BUK ${worker.bukEmployeeId}`;
}
