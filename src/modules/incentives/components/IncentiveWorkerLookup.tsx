import { WorkerLookupField, buildWorkerLookupIdentityLine } from "../../../shared/ui";
import { useHrIncentiveWorkerSearch } from "../hooks/useIncentivesQueries";
import type { HrIncentiveEligibleWorker } from "../types";

type IncentiveWorkerLookupProps = {
  id: string;
  label: string;
  placeholder: string;
  selectedWorker: HrIncentiveEligibleWorker | null;
  onSelect: (worker: HrIncentiveEligibleWorker | null) => void;
  disabled?: boolean;
  excludeBukEmployeeId?: string | null;
};

export function IncentiveWorkerLookup({
  id,
  label,
  placeholder,
  selectedWorker,
  onSelect,
  disabled = false,
  excludeBukEmployeeId = null
}: IncentiveWorkerLookupProps) {
  return (
    <WorkerLookupField
      id={id}
      label={label}
      placeholder={placeholder}
      selectedWorker={selectedWorker}
      onSelect={onSelect}
      disabled={disabled}
      useSearchQuery={useHrIncentiveWorkerSearch}
      getWorkerId={(worker) => worker.bukEmployeeId}
      getWorkerFullName={(worker) => worker.fullName}
      renderWorkerSecondary={(worker) =>
        buildWorkerLookupIdentityLine(worker.documentNumber, worker.jobTitle)
      }
      renderWorkerTertiary={(worker) =>
        worker.areaName || worker.contractCode || "Sin contrato activo"
      }
      loadingMessage="Buscando trabajadores elegibles..."
      filterResults={(workers) =>
        workers.filter((worker) => worker.bukEmployeeId !== excludeBukEmployeeId)
      }
    />
  );
}
