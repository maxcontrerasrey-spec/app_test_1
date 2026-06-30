import { WorkerLookupField, buildWorkerLookupIdentityLine } from "../../../shared/ui";
import { useOperationsDriverSearch } from "../hooks/useOperationsQueries";
import type { Driver } from "../types";

type OperationsDriverLookupProps = {
  id: string;
  label: string;
  placeholder: string;
  selectedWorker: Driver | null;
  serviceDate: string;
  onSelect: (worker: Driver | null) => void;
  disabled?: boolean;
};

export function OperationsDriverLookup({
  id,
  label,
  placeholder,
  selectedWorker,
  serviceDate,
  onSelect,
  disabled = false,
}: OperationsDriverLookupProps) {
  return (
    <WorkerLookupField
      id={id}
      label={label}
      placeholder={placeholder}
      selectedWorker={selectedWorker}
      onSelect={onSelect}
      disabled={disabled}
      useSearchQuery={useOperationsDriverSearch}
      searchContext={serviceDate}
      getWorkerId={(worker) => worker.id}
      getWorkerFullName={(worker) => worker.fullName}
      renderWorkerSecondary={(worker) =>
        buildWorkerLookupIdentityLine(worker.documentNumber, worker.jobTitle || "Sin cargo")
      }
      renderWorkerTertiary={(worker) =>
        worker.areaName || worker.contractCode || "Sin contrato activo"
      }
      loadingMessage="Buscando conductores..."
      emptyMessage="No hay conductores que coincidan con la búsqueda actual."
    />
  );
}
