import { StandardWorkerLookupField } from "../../../shared/ui";
import { useInternalMobilityWorkerSearch } from "../hooks/useInternalMobilityQueries";
import { buildInternalMobilityWorkerRecordLabel } from "../lib/workerPresentation";
import type { InternalMobilityEligibleWorker } from "../types";

type InternalMobilityWorkerLookupProps = {
  id: string;
  label: string;
  placeholder: string;
  selectedWorker: InternalMobilityEligibleWorker | null;
  onSelect: (worker: InternalMobilityEligibleWorker | null) => void;
  disabled?: boolean;
};

export function InternalMobilityWorkerLookup({
  id,
  label,
  placeholder,
  selectedWorker,
  onSelect,
  disabled = false
}: InternalMobilityWorkerLookupProps) {
  const hasMultipleActiveRecords = Boolean(selectedWorker && selectedWorker.activeRecordCount > 1);
  const duplicateRecordsQuery = useInternalMobilityWorkerSearch(
    selectedWorker?.fullName ?? "",
    hasMultipleActiveRecords
  );
  const selectedBukEmployeeId = selectedWorker?.bukEmployeeId ?? "";
  const selectedDocument = selectedWorker?.documentNumber.replace(/[^0-9Kk]/g, "").toUpperCase();
  const duplicateRecords = (duplicateRecordsQuery.data ?? []).filter((worker) =>
    worker.documentNumber.replace(/[^0-9Kk]/g, "").toUpperCase() === selectedDocument
  );

  return (
    <>
      <StandardWorkerLookupField
        id={id}
        label={label}
        placeholder={placeholder}
        selectedWorker={selectedWorker}
        onSelect={onSelect}
        disabled={disabled}
        useSearchQuery={useInternalMobilityWorkerSearch}
        loadingMessage="Buscando trabajadores activos..."
        fallbackLineLabel="Sin área activa"
        getAreaName={buildInternalMobilityWorkerRecordLabel}
        includeCompanyName
      />
      {hasMultipleActiveRecords ? (
        <div className="mobility-record-selector" role="group" aria-label="Seleccionar ficha BUK">
          <span className="mobility-record-selector__label">Selecciona la ficha BUK que será movilizada</span>
          {duplicateRecordsQuery.isLoading ? (
            <span className="mobility-record-selector__status">Cargando fichas activas...</span>
          ) : null}
          <div className="mobility-record-selector__options">
            {duplicateRecords.map((worker) => (
              <button
                key={worker.bukEmployeeId}
                type="button"
                className={`mobility-record-selector__option${worker.bukEmployeeId === selectedBukEmployeeId ? " is-selected" : ""}`}
                aria-pressed={worker.bukEmployeeId === selectedBukEmployeeId}
                onClick={() => onSelect(worker)}
              >
                <strong>Ficha BUK {worker.bukEmployeeId}</strong>
                <span>{worker.areaName ?? worker.contractCode ?? "Sin área activa"}</span>
                {worker.companyName ? <span>{worker.companyName}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
