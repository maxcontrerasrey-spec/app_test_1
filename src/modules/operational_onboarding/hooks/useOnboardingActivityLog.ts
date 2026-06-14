import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";

export type OnboardingActivityLogRow = {
  id: string;
  case_id: string;
  task_id: string | null;
  action: string;
  old_value: any;
  new_value: any;
  comment: string | null;
  created_by: string | null;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
  tasks?: {
    task_name: string;
  };
  cases?: {
    candidates?: { first_name: string; last_name: string };
    employees?: { first_name: string; last_name: string };
  };
};

export function useOnboardingActivityLog() {
  return useQuery({
    queryKey: ["operational-onboarding-activity-log"],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured");

      const { data, error } = await supabase
        .from("employee_onboarding_activity_log")
        .select(
          `
          *,
          profiles:created_by(first_name, last_name),
          tasks:employee_onboarding_tasks(task_name),
          cases:employee_onboarding_cases(
            candidates:candidate_profiles(first_name, last_name),
            employees:employees(first_name, last_name)
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data as unknown as OnboardingActivityLogRow[];
    },
  });
}
