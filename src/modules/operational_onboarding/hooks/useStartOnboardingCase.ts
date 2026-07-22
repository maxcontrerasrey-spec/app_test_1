import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { supabase } from "../../../shared/lib/supabase";

type StartOnboardingArgs = {
  candidateId: string;
  templateId: string;
};

export function useStartOnboardingCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ candidateId, templateId }: StartOnboardingArgs) => {
      if (!supabase) throw new Error("Supabase is not configured");

      const { data, error } = await supabase.rpc(
        "start_operational_onboarding",
        {
          p_candidate_id: candidateId,
          p_template_id: templateId,
        },
      );

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.operationalOnboarding.cases(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.operationalOnboarding.tasks(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.operationalOnboarding.activityLog(),
      });
    },
  });
}
