import { WorkerLookupField, buildWorkerLookupIdentityLine } from "../../../shared/ui";
import { useInternalMobilityWorkerSearch } from "../hooks/useInternalMobilityQueries";
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
  return (
    <WorkerLookupField
      id={id}
      label={label}
      placeholder={placeholder}
      selectedWorker={selectedWorker}
      onSelect={onSelect}
      disabled={disabled}
      useSearchQuery={useInternalMobilityWorkerSearch}
      getWorkerId={(worker) => worker.bukEmployeeId}
      getWorkerFullName={(worker) => worker.fullName}
      renderWorkerSecondary={(worker) =>
        buildWorkerLookupIdentityLine(worker.documentNumber, worker.jobTitle)
      }
      renderWorkerTertiary={(worker) =>
        `${worker.areaName || worker.contractCode || "Sin área activa"}${
          worker.companyName ? ` · ${worker.companyName}` : ""
        }`
      }
      loadingMessage="Buscando trabajadores activos..."
    />
  );
}
