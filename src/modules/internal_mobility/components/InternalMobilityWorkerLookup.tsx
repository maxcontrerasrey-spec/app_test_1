import { StandardWorkerLookupField } from "../../../shared/ui";
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
      includeCompanyName
    />
  );
}
