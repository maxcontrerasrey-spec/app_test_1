import { supabase } from "../../../shared/lib/supabase";
import type { DashboardWidget, UserWidgetPreference, DashboardNotification, ResolvedWidget } from "../types";

export const dashboardService = {
  /**
   * Fetches all active widgets allowed for the current user's roles.
   * Supabase RLS is configured to only allow reads, but we also filter locally for safety if needed.
   */
  async getAvailableWidgets(userRoles: string[]): Promise<DashboardWidget[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("dashboard_widgets")
      .select("*")
      .eq("is_active", true)
      .order("default_position", { ascending: true });

    if (error) {
      console.error("Error fetching widgets:", error);
      return [];
    }

    // Filter locally based on roles if array intersection is tricky in RPC right now
    // In a fully zero-trust setup, this could also be handled by an RPC.
    return (data as DashboardWidget[]).filter((widget) => {
      // If widget has no role restrictions, it's public
      if (!widget.allowed_roles || widget.allowed_roles.length === 0) return true;
      // Check if user has at least one of the allowed roles
      return widget.allowed_roles.some((role) => userRoles.includes(role));
    });
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
  }
};
