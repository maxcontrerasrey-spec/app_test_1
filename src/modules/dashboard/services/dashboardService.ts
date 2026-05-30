import { supabase } from "../../../shared/lib/supabase";
import type {
  DashboardApprovalTrackingItem,
  DashboardActiveFolioItem,
  DashboardBirthdayItem,
  DashboardWeatherContext,
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

  async getUpcomingBirthdays(limit = 3): Promise<DashboardBirthdayItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_upcoming_birthdays", { p_limit: limit });
    if (error) {
      console.error("Error fetching upcoming birthdays:", error);
      return [];
    }

    return (data ?? []) as DashboardBirthdayItem[];
  },

  async getWeatherContext(userId: string | null | undefined): Promise<DashboardWeatherContext | null> {
    if (!supabase || !userId) return null;

    const { data, error } = await supabase
      .from("user_contracts")
      .select("contracts:contract_id (code, contract_name, cost_center_name, is_active)")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching weather context:", error);
      return null;
    }

    const rows = Array.isArray(data) ? data : [];
    const contracts = rows
      .map((row) => row.contracts as {
        code?: string | null;
        contract_name?: string | null;
        cost_center_name?: string | null;
        is_active?: boolean | null;
      } | null)
      .filter((contract): contract is {
        code?: string | null;
        contract_name?: string | null;
        cost_center_name?: string | null;
        is_active?: boolean | null;
      } => Boolean(contract && contract.is_active !== false));

    if (contracts.length === 0) {
      return null;
    }

    const zoneCounts = new Map<string, number>();
    for (const contract of contracts) {
      const zone = contract.cost_center_name?.trim();
      if (!zone) continue;
      zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);
    }

    const primaryZone =
      [...zoneCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const primaryContract = contracts[0] ?? null;

    return {
      zone_name: primaryZone,
      primary_contract_code: primaryContract?.code ?? null,
      primary_contract_name: primaryContract?.contract_name ?? null,
      contract_count: contracts.length
    };
  }
};
