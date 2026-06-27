import { useEffect, useMemo, useState } from "react";
import { formatRut } from "../../lib/rut";

type WorkerLookupSearchResult<TWorker> = {
  data?: TWorker[];
  error: Error | null;
  isLoading: boolean;
};

type WorkerLookupFieldProps<TWorker> = {
  id: string;
  label: string;
  placeholder: string;
  selectedWorker: TWorker | null;
  onSelect: (worker: TWorker | null) => void;
  useSearchQuery: (
    search: string,
    enabled: boolean
  ) => WorkerLookupSearchResult<TWorker>;
  getWorkerId: (worker: TWorker) => string;
  getWorkerFullName: (worker: TWorker) => string;
  renderWorkerSecondary: (worker: TWorker) => string;
  renderWorkerTertiary: (worker: TWorker) => string;
  loadingMessage: string;
  emptyMessage?: string;
  clearLabel?: string;
  debounceMs?: number;
  disabled?: boolean;
  minSearchLength?: number;
  onSearchChange?: (value: string) => void;
  filterResults?: (workers: TWorker[]) => TWorker[];
};

export function WorkerLookupField<TWorker>({
  id,
  label,
  placeholder,
  selectedWorker,
  onSelect,
  useSearchQuery,
  getWorkerId,
  getWorkerFullName,
  renderWorkerSecondary,
  renderWorkerTertiary,
  loadingMessage,
  emptyMessage = "No hay coincidencias para la búsqueda actual.",
  clearLabel = "Limpiar",
  debounceMs = 150,
  disabled = false,
  minSearchLength = 2,
  onSearchChange,
  filterResults
}: WorkerLookupFieldProps<TWorker>) {
  const [searchValue, setSearchValue] = useState(
    selectedWorker ? getWorkerFullName(selectedWorker) : ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setSearchValue(selectedWorker ? getWorkerFullName(selectedWorker) : "");
  }, [getWorkerFullName, selectedWorker]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [debounceMs, searchValue]);

  useEffect(() => {
    onSearchChange?.(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  const workerSearchQuery = useSearchQuery(debouncedSearch, !disabled && isOpen);
  const results = useMemo(() => {
    const workers = workerSearchQuery.data ?? [];
    return filterResults ? filterResults(workers) : workers;
  }, [filterResults, workerSearchQuery.data]);

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
            {clearLabel}
          </button>
        ) : null}
      </div>

      {isOpen && debouncedSearch.length >= minSearchLength ? (
        <div className="hr-worker-lookup-results">
          {workerSearchQuery.isLoading ? (
            <div className="hr-worker-lookup-empty">{loadingMessage}</div>
          ) : null}

          {!workerSearchQuery.isLoading && workerSearchQuery.error ? (
            <div className="hr-worker-lookup-empty">
              {workerSearchQuery.error.message}
            </div>
          ) : null}

          {!workerSearchQuery.isLoading &&
          !workerSearchQuery.error &&
          results.length === 0 ? (
            <div className="hr-worker-lookup-empty">{emptyMessage}</div>
          ) : null}

          {!workerSearchQuery.isLoading && !workerSearchQuery.error
            ? results.map((worker) => (
                <button
                  key={getWorkerId(worker)}
                  type="button"
                  className="hr-worker-lookup-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(worker);
                    setSearchValue(getWorkerFullName(worker));
                    setIsOpen(false);
                  }}
                >
                  <strong>{getWorkerFullName(worker)}</strong>
                  <span>{renderWorkerSecondary(worker)}</span>
                  <span>{renderWorkerTertiary(worker)}</span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

export function buildWorkerLookupIdentityLine(documentNumber: string, jobTitle: string) {
  return `${formatRut(documentNumber)} · ${jobTitle}`;
}
