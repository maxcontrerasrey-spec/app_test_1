import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { searchOperationsDrivers } from "../services/operacionesApi";

const OPERATIONS_SEARCH_STALE_TIME_MS = 15_000;
const OPERATIONS_SEARCH_GC_TIME_MS = 20 * 60_000;

export function useOperationsDriverSearch(
  search: string,
  enabled = true,
  searchContext?: unknown,
) {
  const serviceDate = typeof searchContext === "string" ? searchContext : "";
  const normalizedSearch = search.trim();
  const documentDigits = normalizedSearch.replace(/\D/g, "");

  return useQuery({
    queryKey: queryKeys.operations.driverSearch({
      search: normalizedSearch,
      serviceDate,
    }),
    queryFn: () => searchOperationsDrivers(normalizedSearch, serviceDate),
    staleTime: OPERATIONS_SEARCH_STALE_TIME_MS,
    gcTime: OPERATIONS_SEARCH_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled:
      enabled &&
      Boolean(serviceDate) &&
      (normalizedSearch.length >= 2 || documentDigits.length >= 4),
  });
}
