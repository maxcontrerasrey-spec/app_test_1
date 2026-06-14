import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";

export type OnboardingCaseRow = {
  id: string;
  employee_id: string | null;
  candidate_id: string | null;
  hiring_request_id: string | null;
  template_id: string;
  status: string;
  cargo: string | null;
  contrato: string | null;
  faena: string | null;
  division: string | null;
  centro_costo: string | null;
  target_ready_date: string | null;
  progress_percent: number;
  total_tasks: number;
  completed_tasks: number;
  expired_tasks: number;
  blocking_pending_tasks: number;
  created_at: string;
  updated_at: string;
  candidates?: {
    full_name: string;
    email: string | null;
    national_id: string;
  };
  employees?: {
    full_name: string;
    email: string | null;
    document_number: string | null;
  };
};

export function useOnboardingCases() {
  return useQuery({
    queryKey: ["operational-onboarding-cases"],
    queryFn: async () => {
      if (!supabase) {
        throw new Error("Supabase is not configured");
      }

      const { data, error } = await supabase
        .from("employee_onboarding_cases")
        .select(
          `
          *,
          candidates:candidate_profiles (full_name, email, national_id),
          employees:employees (full_name, email, document_number)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data as unknown as OnboardingCaseRow[];
    },
  });
}
