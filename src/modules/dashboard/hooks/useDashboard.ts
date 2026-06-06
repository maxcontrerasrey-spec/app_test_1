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

async function fetchDashboardPayload(userId: string): Promise<DashboardQueryPayload> {
  const [tasks, approvalTracking, activeFolios, birthdays] = await Promise.all([
    dashboardService.getDashboardTasks(userId),
    dashboardService.getDashboardApprovalTracking(),
    dashboardService.getDashboardActiveFolios(),
    dashboardService.getUpcomingBirthdays(6)
  ]);

  return {
    tasksData: tasks,
    approvalTrackingData: approvalTracking,
    activeFoliosData: activeFolios,
    birthdaysData: birthdays
  };
}

export function useDashboard() {
  const { user } = useAuth();

  const {
    data,
    isLoading,
    refetch
  } = useQuery({
    queryKey: queryKeys.dashboard.home(user?.id ?? "anonymous"),
    queryFn: () => fetchDashboardPayload(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 15_000,
    refetchInterval: 30_000,
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
