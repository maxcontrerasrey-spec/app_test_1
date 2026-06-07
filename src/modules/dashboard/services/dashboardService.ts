import { supabase } from "../../../shared/lib/supabase";
import { logger } from "../../../shared/lib/logger";
import type {
  DashboardApprovalTrackingItem,
  DashboardActiveFolioItem,
  DashboardBirthdayItem,
  DashboardTaskItem
} from "../types";

export const dashboardService = {
  async getDashboardHomeBundle(limit = 6): Promise<{
    tasksData: DashboardTaskItem[];
    approvalTrackingData: DashboardApprovalTrackingItem[];
    activeFoliosData: DashboardActiveFolioItem[];
    birthdaysData: DashboardBirthdayItem[];
  }> {
    if (!supabase) {
      return {
        tasksData: [],
        approvalTrackingData: [],
        activeFoliosData: [],
        birthdaysData: []
      };
    }

    const { data, error } = await supabase.rpc("get_dashboard_home_bundle", {
      p_birthdays_limit: limit
    });

    if (error) {
      logger.error("DashboardService getDashboardHomeBundle", error);
      return {
        tasksData: [],
        approvalTrackingData: [],
        activeFoliosData: [],
        birthdaysData: []
      };
    }

    const payload = (data ?? {}) as {
      tasks_data?: DashboardTaskItem[] | null;
      approval_tracking_data?: DashboardApprovalTrackingItem[] | null;
      active_folios_data?: DashboardActiveFolioItem[] | null;
      birthdays_data?: DashboardBirthdayItem[] | null;
    };

    return {
      tasksData: payload.tasks_data ?? [],
      approvalTrackingData: payload.approval_tracking_data ?? [],
      activeFoliosData: payload.active_folios_data ?? [],
      birthdaysData: payload.birthdays_data ?? []
    };
  }
};
