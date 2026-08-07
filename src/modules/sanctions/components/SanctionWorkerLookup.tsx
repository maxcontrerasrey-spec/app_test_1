import { StandardWorkerLookupField } from "../../../shared/ui";
import { useHrSanctionWorkerSearch } from "../hooks/useSanctionsQueries";
import type { HrSanctionWorker } from "../types";

type SanctionWorkerLookupProps = {
  selectedWorker: HrSanctionWorker | null;
  onSelect: (worker: HrSanctionWorker | null) => void;
  disabled?: boolean;
};

export function SanctionWorkerLookup({
  selectedWorker,
  onSelect,
  disabled = false
}: SanctionWorkerLookupProps) {
  return (
    <StandardWorkerLookupField
      id="sanction-worker"
      label="Trabajador"
      placeholder="Buscar por nombre, RUT, cargo o contrato"
      selectedWorker={selectedWorker}
      onSelect={onSelect}
      disabled={disabled}
      useSearchQuery={useHrSanctionWorkerSearch}
      loadingMessage="Buscando trabajadores activos..."
    />
  );
}
