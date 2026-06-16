import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";

export type OnboardingActivityLogRow = {
  id: string;
  case_id: string;
  task_id: string | null;
  action: string;
  old_value: unknown;
  new_value: unknown;
  comment: string | null;
  created_by: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
  };
  tasks?: {
    task_name: string;
  };
  cases?: {
    candidates?: { full_name: string };
    employees?: { full_name: string };
  };
};

export function useOnboardingActivityLog() {
  return useQuery({
    queryKey: ["operational-onboarding-activity-log"],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured");

      const { data, error } = await supabase.rpc("get_operational_onboarding_activity_log");

      if (error) {
        throw error;
      }

      if (!Array.isArray(data)) {
        throw new Error("Payload inválido al cargar bitácora de alta operacional.");
      }

      return data as OnboardingActivityLogRow[];
    },
  });
}
