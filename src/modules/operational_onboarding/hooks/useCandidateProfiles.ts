import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { supabase } from "../../../shared/lib/supabase";

export type CandidateProfileRow = {
  id: string;
  full_name: string;
  national_id: string | null;
  status: string;
};

export function useCandidateProfiles() {
  return useQuery({
    queryKey: queryKeys.operationalOnboarding.candidateProfiles(),
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured");

      const { data, error } = await supabase.rpc("get_operational_onboarding_candidate_profiles");

      if (error) throw error;

      if (!Array.isArray(data)) {
        throw new Error("Payload inválido al cargar candidatos para alta operacional.");
      }

      return data as CandidateProfileRow[];
    },
  });
}
