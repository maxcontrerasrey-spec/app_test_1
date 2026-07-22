import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
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
    queryKey: queryKeys.operationalOnboarding.cases(),
    queryFn: async () => {
      if (!supabase) {
        throw new Error("Supabase is not configured");
      }

      const { data, error } = await supabase.rpc("get_operational_onboarding_cases");

      if (error) {
        throw error;
      }

      if (!Array.isArray(data)) {
        throw new Error("Payload inválido al cargar casos de alta operacional.");
      }

      return data as OnboardingCaseRow[];
    },
  });
}
