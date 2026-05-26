import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/context/AuthContext";
import { dashboardService } from "../services/dashboardService";
import type {
  DashboardActiveFolioItem,
  DashboardAlertItem,
  DashboardKpis,
  DashboardNotification,
  DashboardTaskItem,
  ResolvedWidget
} from "../types";

type DashboardQueryPayload = {
  widgets: ResolvedWidget[];
  notifications: DashboardNotification[];
  tasksData: DashboardTaskItem[];
  activeFoliosData: DashboardActiveFolioItem[];
  alertsData: DashboardAlertItem[];
  kpisData: DashboardKpis | null;
};

async function fetchDashboardPayload(userId: string): Promise<DashboardQueryPayload> {
  const [availableWidgets, userPrefs, unreadNotifications, tasks, activeFolios] = await Promise.all([
    dashboardService.getAvailableWidgets(),
    dashboardService.getUserPreferences(),
    dashboardService.getUnreadNotifications(),
    dashboardService.getDashboardTasks(userId),
    dashboardService.getDashboardActiveFolios()
  ]);

  const resolvedWidgets: ResolvedWidget[] = availableWidgets
    .map((widget) => {
      const pref = userPrefs.find((item) => item.widget_id === widget.id);
      return {
        ...widget,
        position: pref ? pref.position : widget.default_position,
        hidden: pref ? pref.hidden : false,
        size: pref ? pref.size : "medium"
      };
    })
    .sort((a, b) => a.position - b.position);

  return {
    widgets: resolvedWidgets,
    notifications: unreadNotifications,
    tasksData: tasks,
    activeFoliosData: activeFolios,
    alertsData: [],
    kpisData: null
  };
}

export function useDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dashboardQueryKey = useMemo(
    () => ["dashboard-home", user?.id ?? "anonymous"] as const,
    [user?.id]
  );

  const {
    data,
    isLoading,
    refetch
  } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: () => fetchDashboardPayload(user!.id),
    enabled: Boolean(user?.id)
  });

  const preferenceMutation = useMutation({
    mutationFn: async ({
      userId,
      widgetId,
      hidden
    }: {
      userId: string;
      widgetId: string;
      hidden: boolean;
    }) => {
      await dashboardService.saveUserPreference(userId, { widget_id: widgetId, hidden });
    },
    onMutate: async ({ widgetId, hidden }) => {
      await queryClient.cancelQueries({ queryKey: dashboardQueryKey });
      const previous = queryClient.getQueryData<DashboardQueryPayload>(dashboardQueryKey);

      if (previous) {
        queryClient.setQueryData<DashboardQueryPayload>(dashboardQueryKey, {
          ...previous,
          widgets: previous.widgets.map((widget) =>
            widget.id === widgetId ? { ...widget, hidden } : widget
          )
        });
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dashboardQueryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
    }
  });

  const toggleWidgetVisibility = async (widgetId: string, hidden: boolean) => {
    if (!user?.id) return;
    await preferenceMutation.mutateAsync({ userId: user.id, widgetId, hidden });
  };

  return {
    widgets: data?.widgets ?? [],
    notifications: data?.notifications ?? [],
    tasksData: data?.tasksData ?? [],
    activeFoliosData: data?.activeFoliosData ?? [],
    alertsData: data?.alertsData ?? [],
    kpisData: data?.kpisData ?? null,
    isLoading,
    toggleWidgetVisibility,
    refresh: refetch
  };
}
