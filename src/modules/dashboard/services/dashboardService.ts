import { supabase } from "../../../shared/lib/supabase";
import type {
  DashboardApprovalTrackingItem,
  DashboardActiveFolioItem,
  DashboardAlertItem,
  DashboardKpis,
  DashboardNotification,
  DashboardTaskItem,
  DashboardWidget,
  UserWidgetPreference
} from "../types";

export const dashboardService = {
  /**
   * Fetches all active widgets already resolved by backend for the current user.
   */
  async getAvailableWidgets(): Promise<DashboardWidget[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_dashboard_widgets_for_current_user");

    if (error) {
      console.error("Error fetching widgets:", error);
      return [];
    }

    return (data ?? []) as DashboardWidget[];
  },

  /**
   * Fetches the user's specific layout preferences.
   */
  async getUserPreferences(): Promise<UserWidgetPreference[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("user_dashboard_preferences")
      .select("*");

    if (error) {
      console.error("Error fetching user preferences:", error);
      return [];
    }

    return data as UserWidgetPreference[];
  },

  /**
   * Updates or inserts a widget preference for the user.
   */
  async saveUserPreference(userId: string, preference: Partial<UserWidgetPreference> & { widget_id: string }) {
    if (!supabase) return;
    const { error } = await supabase
      .from("user_dashboard_preferences")
      .upsert({
        user_id: userId,
        ...preference,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,widget_id' });

    if (error) {
      console.error("Error saving user preference:", error);
    }
  },

  /**
   * Fetches unread notifications for the user.
   */
  async getUnreadNotifications(): Promise<DashboardNotification[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }

    return data as DashboardNotification[];
  },

  /**
   * Fetches dynamic tasks for the TasksWidget via RPC
   */
  async getDashboardTasks(userId: string): Promise<DashboardTaskItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_dashboard_tasks", { p_user_id: userId });
    if (error) {
      console.error("Error fetching dashboard tasks:", error);
      return [];
    }
    return (data ?? []) as DashboardTaskItem[];
  },

  async getDashboardApprovalTracking(): Promise<DashboardApprovalTrackingItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_dashboard_approval_tracking");
    if (error) {
      console.error("Error fetching dashboard approval tracking:", error);
      return [];
    }
    return (data ?? []) as DashboardApprovalTrackingItem[];
  },

  async getDashboardActiveFolios(): Promise<DashboardActiveFolioItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_recruitment_control_dashboard_v2");
    if (error) {
      console.error("Error fetching active folios:", error);
      return [];
    }

    const payload = (data ?? {}) as {
      active_cases?: DashboardActiveFolioItem[] | null;
    };

    return payload.active_cases ?? [];
  },

  /**
   * Fetches dynamic alerts for the AlertsWidget via RPC
   */
  async getDashboardAlerts(userId: string): Promise<DashboardAlertItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_dashboard_alerts", { p_user_id: userId });
    if (error) {
      console.error("Error fetching dashboard alerts:", error);
      return [];
    }
    return (data ?? []) as DashboardAlertItem[];
  },

  /**
   * Fetches dynamic KPIs for the KPIWidget via RPC
   */
  async getDashboardKpis(userId: string): Promise<DashboardKpis | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("get_dashboard_kpis", { p_user_id: userId });
    if (error) {
      console.error("Error fetching dashboard KPIs:", error);
      return null;
    }
    return (data ?? null) as DashboardKpis | null;
  }
};
