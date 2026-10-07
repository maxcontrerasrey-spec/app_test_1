import { useEffect, useMemo, useRef, useState } from "react";
import { formatRut } from "../../lib/rut";
import { WORKER_SEARCH_DEBOUNCE_MS, isWorkerSearchReady } from "../../lib/workerSearch";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

type WorkerLookupSearchResult<TWorker> = {
  data?: TWorker[];
  error: Error | null;
  isLoading: boolean;
};

type WorkerLookupFieldProps<TWorker, TSearchContext = unknown> = {
  id: string;
  label: string;
  placeholder: string;
  selectedWorker: TWorker | null;
  onSelect: (worker: TWorker | null) => void;
  useSearchQuery: (
    search: string,
    enabled: boolean,
    searchContext?: TSearchContext
  ) => WorkerLookupSearchResult<TWorker>;
  searchContext?: TSearchContext;
  getWorkerId: (worker: TWorker) => string;
  getWorkerFullName: (worker: TWorker) => string;
  renderWorkerSecondary: (worker: TWorker) => string;
  renderWorkerTertiary: (worker: TWorker) => string;
  loadingMessage: string;
  emptyMessage?: string;
  clearLabel?: string;
  disabled?: boolean;
  required?: boolean;
  minSearchLength?: number;
  onSearchChange?: (value: string) => void;
  filterResults?: (workers: TWorker[]) => TWorker[];
};

export const isWorkerLookupSearchReady = isWorkerSearchReady;

export function WorkerLookupField<TWorker, TSearchContext = unknown>({
  id,
  label,
  placeholder,
  selectedWorker,
  onSelect,
  useSearchQuery,
  searchContext,
  getWorkerId,
  getWorkerFullName,
  renderWorkerSecondary,
  renderWorkerTertiary,
  loadingMessage,
  emptyMessage = "No hay coincidencias para la búsqueda actual.",
  clearLabel = "Limpiar",
  disabled = false,
  required = false,
  minSearchLength = 2,
  onSearchChange,
  filterResults
}: WorkerLookupFieldProps<TWorker, TSearchContext>) {
  const [searchValue, setSearchValue] = useState(
    selectedWorker ? getWorkerFullName(selectedWorker) : ""
  );
  const [isOpen, setIsOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(
    searchValue.trim(),
    WORKER_SEARCH_DEBOUNCE_MS,
    ""
  );
  const lastSyncedWorkerIdRef = useRef<string | null>(
    selectedWorker ? getWorkerId(selectedWorker) : null
  );

  useEffect(() => {
    const selectedWorkerId = selectedWorker ? getWorkerId(selectedWorker) : null;

    if (selectedWorkerId === lastSyncedWorkerIdRef.current) {
      return;
    }

    lastSyncedWorkerIdRef.current = selectedWorkerId;
    setSearchValue(selectedWorker ? getWorkerFullName(selectedWorker) : "");
  }, [getWorkerFullName, getWorkerId, selectedWorker]);

  const hasSearchableText = isWorkerLookupSearchReady(
    debouncedSearch,
    minSearchLength
  );

  const workerSearchQuery = useSearchQuery(
    debouncedSearch,
    !disabled && isOpen && hasSearchableText,
    searchContext
  );
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
          required={required && !selectedWorker}
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
            onSearchChange?.(nextValue);

            if (selectedWorker) {
              lastSyncedWorkerIdRef.current = null;
              onSelect(null);
            } else if (!nextValue.trim()) {
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
              onSearchChange?.("");
              onSelect(null);
            }}
          >
            {clearLabel}
          </button>
        ) : null}
      </div>

      {isOpen && hasSearchableText ? (
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
                    onSearchChange?.(getWorkerFullName(worker));
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
