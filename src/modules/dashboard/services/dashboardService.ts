import { supabase } from "../../../shared/lib/supabase";
import { logger } from "../../../shared/lib/logger";
import type {
  DashboardApprovalTrackingItem,
  DashboardActiveFolioItem,
  DashboardBirthdayItem,
  DashboardTaskItem
} from "../types";

export const dashboardService = {
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
