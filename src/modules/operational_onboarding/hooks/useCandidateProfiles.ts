import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";

export type CandidateProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  rut: string | null;
  status: string;
};

export function useCandidateProfiles() {
  return useQuery({
    queryKey: ["candidate-profiles-list"],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured");

      const { data, error } = await supabase
        .from("candidate_profiles")
        .select("id, first_name, last_name, rut, status")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CandidateProfileRow[];
    },
  });
}
