import { StandardWorkerLookupField } from "../../../shared/ui";
import { useRosterWorkerSearch } from "../hooks/useRosterQueries";
import type { RosterWorkerSearchItem } from "../types";

type RosterWorkerLookupProps = {
  id: string;
  label: string;
  placeholder: string;
  selectedWorker: RosterWorkerSearchItem | null;
  onSelect: (worker: RosterWorkerSearchItem | null) => void;
  onSearchChange?: (value: string) => void;
  disabled?: boolean;
};

export function RosterWorkerLookup({
  id,
  label,
  placeholder,
  selectedWorker,
  onSelect,
  onSearchChange,
  disabled = false
}: RosterWorkerLookupProps) {
  return (
    <StandardWorkerLookupField
      id={id}
      label={label}
      placeholder={placeholder}
      selectedWorker={selectedWorker}
      onSelect={onSelect}
      disabled={disabled}
      useSearchQuery={useRosterWorkerSearch}
      loadingMessage="Buscando trabajadores..."
      onSearchChange={onSearchChange}
    />
  );
}
