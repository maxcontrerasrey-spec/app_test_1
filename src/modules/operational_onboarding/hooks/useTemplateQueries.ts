import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  fetchTemplateTasks,
  upsertTemplateTask,
  deleteTemplateTask,
} from "../services/templateApi";
import type { OnboardingTemplateInput, OnboardingTemplateTaskInput } from "../types";

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.operationalOnboarding.templates(),
    queryFn: fetchTemplates,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.operationalOnboarding.templates() });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      template,
    }: {
      id: string;
      template: OnboardingTemplateInput;
    }) => updateTemplate(id, template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.operationalOnboarding.templates() });
    },
  });
}

export function useTemplateTasks(templateId: string) {
  return useQuery({
    queryKey: queryKeys.operationalOnboarding.templateTasks(templateId),
    queryFn: () => fetchTemplateTasks(templateId),
    enabled: !!templateId,
  });
}

export function useUpsertTemplateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OnboardingTemplateTaskInput) => upsertTemplateTask(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.operationalOnboarding.templateTasks(variables.template_id),
      });
    },
  });
}

export function useDeleteTemplateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; templateId: string; comment?: string | null }) =>
      deleteTemplateTask(id, comment),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.operationalOnboarding.templateTasks(variables.templateId),
      });
    },
  });
}
