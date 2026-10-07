import { useCallback, useState } from "react";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import {
  normalizeRutAwareWorkerSearchTerm,
  WORKER_SEARCH_DEBOUNCE_MS
} from "../../../shared/lib/workerSearch";
import {
  useRosterBulkCalendar,
  useRosterCalendarScopeSummary,
  useRosterCalendarSummary
} from "./useRosterQueries";

const ROSTER_CALENDAR_PAGE_SIZE = 50;

type RosterCalendarCursor = { fullName: string; bukEmployeeId: string };

export function useRosterCalendarBrowse(params: {
  workerSearchTerm: string;
  startDate: string;
  endDate: string;
  areaFilter: string;
  contractAdministratorFilter: string;
  cycleFilter: string;
  isPatternsView: boolean;
}) {
  const {
    workerSearchTerm,
    startDate,
    endDate,
    areaFilter,
    contractAdministratorFilter,
    cycleFilter,
    isPatternsView
  } = params;
  const normalizedWorkerSearchTerm = normalizeRutAwareWorkerSearchTerm(workerSearchTerm);
  const calendarSearchTerm = useDebouncedValue(
    normalizedWorkerSearchTerm,
    WORKER_SEARCH_DEBOUNCE_MS,
    ""
  );
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<Array<RosterCalendarCursor | null>>([null]);
  const hasScopeFilter = Boolean(areaFilter.trim() || contractAdministratorFilter.trim());
  const isSearchPending = calendarSearchTerm !== normalizedWorkerSearchTerm;
  const currentCursor = pageCursors[page - 1] ?? null;

  const resetPagination = useCallback(() => {
    setPage(1);
    setPageCursors([null]);
  }, []);

  const changePage = useCallback((nextPage: number, cursor?: RosterCalendarCursor) => {
    if (nextPage > page) {
      if (!cursor) return;
      setPageCursors((current) => [...current.slice(0, nextPage - 1), cursor]);
    }
    setPage(nextPage);
  }, [page]);

  const monthValue = startDate.slice(0, 7);
  const globalSummaryQuery = useRosterCalendarSummary({
    monthValue,
    search: calendarSearchTerm,
    areaFilter,
    enabled: !isPatternsView && !hasScopeFilter && !isSearchPending
  });
  const scopeSummaryQuery = useRosterCalendarScopeSummary({
    startDate,
    endDate,
    search: calendarSearchTerm,
    areaFilter,
    contractAdministratorFilter,
    enabled: !isPatternsView && hasScopeFilter && !isSearchPending
  });
  const calendarPageQuery = useRosterBulkCalendar({
    startDate,
    endDate,
    search: calendarSearchTerm,
    areaFilter,
    contractAdministratorFilter,
    cycleFilter,
    page,
    pageSize: ROSTER_CALENDAR_PAGE_SIZE,
    cursor: currentCursor,
    enabled: !isPatternsView && hasScopeFilter && !isSearchPending
  });

  return {
    calendarSearchTerm,
    isSearchPending,
    hasScopeFilter,
    page,
    pageSize: ROSTER_CALENDAR_PAGE_SIZE,
    resetPagination,
    changePage,
    globalSummaryQuery,
    scopeSummaryQuery,
    calendarPageQuery,
    isSummaryLoading: hasScopeFilter
      ? scopeSummaryQuery.isLoading || isSearchPending
      : globalSummaryQuery.isLoading || isSearchPending,
    assignedCount: hasScopeFilter
      ? scopeSummaryQuery.data?.assignedCount ?? 0
      : globalSummaryQuery.data?.assignedCount ?? 0,
    pendingCount: hasScopeFilter
      ? scopeSummaryQuery.data?.pendingCount ?? 0
      : globalSummaryQuery.data?.pendingCount ?? 0
  };
}
