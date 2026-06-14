import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";

export type CandidateProfileRow = {
  id: string;
  full_name: string;
  national_id: string | null;
  status: string;
};

export function useCandidateProfiles() {
  return useQuery({
    queryKey: ["candidate-profiles-list"],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured");

      const { data, error } = await supabase
        .from("candidate_profiles")
        .select("id, full_name, national_id, status")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CandidateProfileRow[];
    },
  });
}
