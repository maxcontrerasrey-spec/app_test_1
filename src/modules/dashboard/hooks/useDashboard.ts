import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/context/AuthContext";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { dashboardService } from "../services/dashboardService";
import type {
  DashboardApprovalTrackingItem,
  DashboardActiveFolioItem,
  DashboardBirthdayItem,
  DashboardTaskItem
} from "../types";

type DashboardQueryPayload = {
  tasksData: DashboardTaskItem[];
  approvalTrackingData: DashboardApprovalTrackingItem[];
  activeFoliosData: DashboardActiveFolioItem[];
  birthdaysData: DashboardBirthdayItem[];
};

export function useDashboard() {
  const { user } = useAuth();

  const {
    data,
    isLoading,
    refetch
  } = useQuery({
    queryKey: queryKeys.dashboard.home(user?.id ?? "anonymous"),
    queryFn: () => dashboardService.getDashboardHomeBundle(6),
    enabled: Boolean(user?.id),
    staleTime: 15_000,
    refetchInterval: 180_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  return {
    tasksData: data?.tasksData ?? [],
    approvalTrackingData: data?.approvalTrackingData ?? [],
    activeFoliosData: data?.activeFoliosData ?? [],
    birthdaysData: data?.birthdaysData ?? [],
    isLoading,
    refresh: refetch
  };
}
