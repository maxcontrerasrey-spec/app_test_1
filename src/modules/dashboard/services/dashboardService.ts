import { supabase } from "../../../shared/lib/supabase";
import { logger } from "../../../shared/lib/logger";
import type {
  DashboardApprovalTrackingItem,
  DashboardActiveFolioItem,
  DashboardBirthdayItem,
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
      logger.error("DashboardService getAvailableWidgets", error);
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
      logger.error("DashboardService getUserPreferences", error);
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
      logger.error("DashboardService saveUserPreference", error);
    }
  },

  /**
   * Fetches dynamic tasks for the TasksWidget via RPC
   */
  async getDashboardTasks(userId: string): Promise<DashboardTaskItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_dashboard_tasks", { p_user_id: userId });
    if (error) {
      logger.error("DashboardService getDashboardTasks", error);
      return [];
    }
    return (data ?? []) as DashboardTaskItem[];
  },

  async getDashboardApprovalTracking(): Promise<DashboardApprovalTrackingItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_dashboard_approval_tracking");
    if (error) {
      logger.error("DashboardService getDashboardApprovalTracking", error);
      return [];
    }
    return (data ?? []) as DashboardApprovalTrackingItem[];
  },

  async getDashboardActiveFolios(): Promise<DashboardActiveFolioItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_recruitment_control_dashboard_v2");
    if (error) {
      logger.error("DashboardService getDashboardActiveFolios", error);
      return [];
    }

    const payload = (data ?? {}) as {
      active_cases?: DashboardActiveFolioItem[] | null;
    };

    return payload.active_cases ?? [];
  },

  async getUpcomingBirthdays(limit = 3): Promise<DashboardBirthdayItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_upcoming_birthdays", { p_limit: limit });
    if (error) {
      logger.error("DashboardService getUpcomingBirthdays", error);
      return [];
    }

    return (data ?? []) as DashboardBirthdayItem[];
  }
};
