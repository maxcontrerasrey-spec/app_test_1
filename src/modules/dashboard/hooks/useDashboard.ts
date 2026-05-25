import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { dashboardService } from "../services/dashboardService";
import type {
  DashboardAlertItem,
  DashboardKpis,
  DashboardNotification,
  DashboardTaskItem,
  ResolvedWidget
} from "../types";

export function useDashboard() {
  const { user, appRoles } = useAuth();
  const [widgets, setWidgets] = useState<ResolvedWidget[]>([]);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  
  // Data stores for widgets
  const [tasksData, setTasksData] = useState<DashboardTaskItem[]>([]);
  const [alertsData, setAlertsData] = useState<DashboardAlertItem[]>([]);
  const [kpisData, setKpisData] = useState<DashboardKpis | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const [availableWidgets, userPrefs, unreadNotifications, tasks, alerts, kpis] = await Promise.all([
        dashboardService.getAvailableWidgets(appRoles),
        dashboardService.getUserPreferences(),
        dashboardService.getUnreadNotifications(),
        dashboardService.getDashboardTasks(user.id),
        dashboardService.getDashboardAlerts(user.id),
        dashboardService.getDashboardKpis(user.id)
      ]);

      // Merge base widgets with user preferences
      const resolvedWidgets: ResolvedWidget[] = availableWidgets.map(widget => {
        const pref = userPrefs.find(p => p.widget_id === widget.id);
        return {
          ...widget,
          position: pref ? pref.position : widget.default_position,
          hidden: pref ? pref.hidden : false,
          size: pref ? pref.size : 'medium'
        };
      });

      // Sort by position
      resolvedWidgets.sort((a, b) => a.position - b.position);

      setWidgets(resolvedWidgets);
      setNotifications(unreadNotifications);
      setTasksData(tasks);
      setAlertsData(alerts);
      setKpisData(kpis);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, appRoles]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const toggleWidgetVisibility = async (widgetId: string, hidden: boolean) => {
    if (!user) return;
    
    // Optimistic UI update
    setWidgets(current => 
      current.map(w => w.id === widgetId ? { ...w, hidden } : w)
    );

    await dashboardService.saveUserPreference(user.id, { widget_id: widgetId, hidden });
  };

  return {
    widgets,
    notifications,
    tasksData,
    alertsData,
    kpisData,
    isLoading,
    toggleWidgetVisibility,
    refresh: loadDashboardData
  };
}
