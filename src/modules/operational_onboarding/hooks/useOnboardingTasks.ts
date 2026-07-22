import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { supabase } from "../../../shared/lib/supabase";

export type OnboardingTaskRow = {
  id: string;
  case_id: string;
  template_task_id: string | null;
  area_responsible: string;
  owner_user_id: string | null;
  role_responsible: string | null;
  task_name: string;
  task_description: string | null;
  status:
    | "pending"
    | "in_progress"
    | "completed"
    | "rejected"
    | "not_applicable"
    | "expired";
  is_required: boolean;
  is_blocking: boolean;
  requires_evidence: boolean;
  evidence_type: string | null;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  close_comment: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  cases?: {
    candidates?: { full_name: string };
    employees?: { full_name: string };
  };
};

export function useOnboardingTasks() {
  return useQuery({
    queryKey: queryKeys.operationalOnboarding.tasks(),
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured");

      const { data, error } = await supabase.rpc("get_operational_onboarding_tasks");

      if (error) {
        throw error;
      }

      if (!Array.isArray(data)) {
        throw new Error("Payload inválido al cargar tareas de alta operacional.");
      }

      return data as OnboardingTaskRow[];
    },
  });
}
