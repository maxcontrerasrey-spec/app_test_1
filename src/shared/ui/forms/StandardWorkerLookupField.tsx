import {
  WorkerLookupField,
  buildWorkerLookupIdentityLine,
} from "./WorkerLookupField";

type WorkerLookupSearchResult<TWorker> = {
  data?: TWorker[];
  error: Error | null;
  isLoading: boolean;
};

type StandardWorkerLookupBase = {
  fullName: string;
  documentNumber: string;
  jobTitle?: string | null;
  areaName?: string | null;
  contractCode?: string | null;
  companyName?: string | null;
  bukEmployeeId?: string;
  id?: string;
};

type StandardWorkerLookupFieldProps<
  TWorker extends StandardWorkerLookupBase,
  TSearchContext = unknown,
> = {
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
  loadingMessage: string;
  emptyMessage?: string;
  clearLabel?: string;
  debounceMs?: number;
  disabled?: boolean;
  minSearchLength?: number;
  onSearchChange?: (value: string) => void;
  filterResults?: (workers: TWorker[]) => TWorker[];
  getWorkerId?: (worker: TWorker) => string;
  getJobTitle?: (worker: TWorker) => string | null | undefined;
  getAreaName?: (worker: TWorker) => string | null | undefined;
  getContractCode?: (worker: TWorker) => string | null | undefined;
  getCompanyName?: (worker: TWorker) => string | null | undefined;
  fallbackLineLabel?: string;
  includeCompanyName?: boolean;
};

export function StandardWorkerLookupField<
  TWorker extends StandardWorkerLookupBase,
  TSearchContext = unknown,
>({
  getWorkerId = (worker) => worker.bukEmployeeId ?? worker.id ?? "",
  getJobTitle = (worker) => worker.jobTitle,
  getAreaName = (worker) => worker.areaName,
  getContractCode = (worker) => worker.contractCode,
  getCompanyName = (worker) => worker.companyName,
  fallbackLineLabel = "Sin contrato activo",
  includeCompanyName = false,
  ...props
}: StandardWorkerLookupFieldProps<TWorker, TSearchContext>) {
  return (
    <WorkerLookupField<TWorker, TSearchContext>
      {...props}
      getWorkerId={getWorkerId}
      getWorkerFullName={(worker) => worker.fullName}
      renderWorkerSecondary={(worker) =>
        buildWorkerLookupIdentityLine(
          worker.documentNumber,
          getJobTitle(worker) || "Sin cargo"
        )
      }
      renderWorkerTertiary={(worker) => {
        const baseLabel =
          getAreaName(worker) || getContractCode(worker) || fallbackLineLabel;
        const companyName = getCompanyName(worker);

        if (!includeCompanyName || !companyName) {
          return baseLabel;
        }

        return `${baseLabel} · ${companyName}`;
      }}
    />
  );
}
