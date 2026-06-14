import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  fetchTemplateTasks,
  upsertTemplateTask,
  deleteTemplateTask
} from "../services/templateApi";

export function useTemplates() {
  return useQuery({
    queryKey: ["onboarding_templates"],
    queryFn: fetchTemplates
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding_templates"] });
    }
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, template }: { id: string; template: Parameters<typeof updateTemplate>[1] }) =>
      updateTemplate(id, template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding_templates"] });
    }
  });
}

export function useTemplateTasks(templateId: string) {
  return useQuery({
    queryKey: ["onboarding_template_tasks", templateId],
    queryFn: () => fetchTemplateTasks(templateId),
    enabled: !!templateId
  });
}

export function useUpsertTemplateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertTemplateTask,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding_template_tasks", variables.template_id] });
    }
  });
}

export function useDeleteTemplateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; templateId: string }) => deleteTemplateTask(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding_template_tasks", variables.templateId] });
    }
  });
}
