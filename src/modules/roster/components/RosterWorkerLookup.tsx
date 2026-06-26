import { useEffect, useMemo, useState } from "react";
import { formatRut } from "../../../shared/lib/rut";
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
  const [searchValue, setSearchValue] = useState(selectedWorker?.fullName ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setSearchValue(selectedWorker?.fullName ?? "");
  }, [selectedWorker]);

  useEffect(() => {
    onSearchChange?.(searchValue);
  }, [onSearchChange, searchValue]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const workerSearchQuery = useRosterWorkerSearch(debouncedSearch, !disabled && isOpen);
  const results = useMemo(() => workerSearchQuery.data ?? [], [workerSearchQuery.data]);

  return (
    <div className="field-group hr-worker-lookup">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="hr-worker-lookup-shell">
        <input
          id={id}
          className="text-field"
          type="text"
          value={searchValue}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="nope"
          spellCheck={false}
          autoCorrect="off"
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false);
            }, 150);
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setSearchValue(nextValue);

            if (!nextValue.trim()) {
              onSelect(null);
            }
          }}
        />

        {selectedWorker ? (
          <button
            type="button"
            className="hr-worker-lookup-clear"
            onClick={() => {
              setSearchValue("");
              onSelect(null);
            }}
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {isOpen && debouncedSearch.length >= 2 ? (
        <div className="hr-worker-lookup-results">
          {workerSearchQuery.isLoading ? (
            <div className="hr-worker-lookup-empty">Buscando trabajadores...</div>
          ) : null}

          {!workerSearchQuery.isLoading && workerSearchQuery.error ? (
            <div className="hr-worker-lookup-empty">{workerSearchQuery.error.message}</div>
          ) : null}

          {!workerSearchQuery.isLoading && !workerSearchQuery.error && results.length === 0 ? (
            <div className="hr-worker-lookup-empty">
              No hay coincidencias para la búsqueda actual.
            </div>
          ) : null}

          {!workerSearchQuery.isLoading && !workerSearchQuery.error
            ? results.map((worker) => (
                <button
                  key={worker.bukEmployeeId}
                  type="button"
                  className="hr-worker-lookup-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(worker);
                    setSearchValue(worker.fullName);
                    setIsOpen(false);
                  }}
                >
                  <strong>{worker.fullName}</strong>
                  <span>
                    {formatRut(worker.documentNumber)} · {worker.jobTitle}
                  </span>
                  <span>{worker.areaName || worker.contractCode || "Sin contrato activo"}</span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
