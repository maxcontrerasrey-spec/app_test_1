import { supabase } from "../../../shared/lib/supabase";
import { logger } from "../../../shared/lib/logger";
import type {
  DashboardApprovalTrackingItem,
  DashboardActiveFolioItem,
  DashboardBirthdayItem,
  DashboardOperationalSummary,
  DashboardTaskItem
} from "../types";

export const dashboardService = {
  async getDashboardHomeBundle(limit = 6): Promise<{
    tasksData: DashboardTaskItem[];
    approvalTrackingData: DashboardApprovalTrackingItem[];
    activeFoliosData: DashboardActiveFolioItem[];
    birthdaysData: DashboardBirthdayItem[];
    operationalSummaryData: DashboardOperationalSummary | null;
  }> {
    if (!supabase) {
      return {
        tasksData: [],
        approvalTrackingData: [],
        activeFoliosData: [],
        birthdaysData: [],
        operationalSummaryData: null
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
        birthdaysData: [],
        operationalSummaryData: null
      };
    }

    const payload = (data ?? {}) as {
      tasks_data?: DashboardTaskItem[] | null;
      approval_tracking_data?: DashboardApprovalTrackingItem[] | null;
      active_folios_data?: DashboardActiveFolioItem[] | null;
      birthdays_data?: DashboardBirthdayItem[] | null;
      operational_summary_data?: {
        recruitment?: {
          open_processes?: number | null;
          requested_vacancies?: number | null;
          in_progress_candidates?: number | null;
          hired_candidates?: number | null;
        } | null;
        workforce?: {
          total_employees?: number | null;
          medical_leaves_today?: number | null;
          vacations_today?: number | null;
          absenteeism_pct?: number | null;
        } | null;
        incentives?: {
          total_generated?: number | null;
          pending_approval?: number | null;
          approved?: number | null;
          total_amount?: number | null;
        } | null;
      } | null;
    };

    return {
      tasksData: payload.tasks_data ?? [],
      approvalTrackingData: payload.approval_tracking_data ?? [],
      activeFoliosData: payload.active_folios_data ?? [],
      birthdaysData: payload.birthdays_data ?? [],
      operationalSummaryData: payload.operational_summary_data
        ? {
            recruitment: {
              openProcesses: payload.operational_summary_data.recruitment?.open_processes ?? 0,
              requestedVacancies: payload.operational_summary_data.recruitment?.requested_vacancies ?? 0,
              inProgressCandidates: payload.operational_summary_data.recruitment?.in_progress_candidates ?? 0,
              hiredCandidates: payload.operational_summary_data.recruitment?.hired_candidates ?? 0
            },
            workforce: {
              totalEmployees: payload.operational_summary_data.workforce?.total_employees ?? 0,
              medicalLeavesToday: payload.operational_summary_data.workforce?.medical_leaves_today ?? 0,
              vacationsToday: payload.operational_summary_data.workforce?.vacations_today ?? 0,
              absenteeismPct: payload.operational_summary_data.workforce?.absenteeism_pct ?? 0
            },
            incentives: {
              totalGenerated: payload.operational_summary_data.incentives?.total_generated ?? 0,
              pendingApproval: payload.operational_summary_data.incentives?.pending_approval ?? 0,
              approved: payload.operational_summary_data.incentives?.approved ?? 0,
              totalAmount: payload.operational_summary_data.incentives?.total_amount ?? 0
            }
          }
        : null
    };
  }
};
