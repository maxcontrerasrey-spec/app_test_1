import { supabase } from "../../../shared/lib/supabase";
import type { OnboardingTemplate, OnboardingTemplateTask } from "../types";

export async function fetchTemplates() {
  const { data, error } = await supabase!
    .from("onboarding_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as OnboardingTemplate[];
}

export async function createTemplate(
  template: Omit<
    OnboardingTemplate,
    "id" | "created_at" | "updated_at" | "created_by"
  >,
) {
  const { data, error } = await supabase!
    .from("onboarding_templates")
    .insert([template])
    .select()
    .single();

  if (error) throw error;
  return data as OnboardingTemplate;
}

export async function updateTemplate(
  id: string,
  template: Partial<
    Omit<OnboardingTemplate, "id" | "created_at" | "updated_at" | "created_by">
  >,
) {
  const { data, error } = await supabase!
    .from("onboarding_templates")
    .update(template)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as OnboardingTemplate;
}

export async function fetchTemplateTasks(templateId: string) {
  const { data, error } = await supabase!
    .from("onboarding_template_tasks")
    .select("*")
    .eq("template_id", templateId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return data as OnboardingTemplateTask[];
}

export async function upsertTemplateTask(
  task: Partial<OnboardingTemplateTask> & {
    template_id: string;
    area_responsible: string;
    task_name: string;
  },
) {
  const { data, error } = await supabase!
    .from("onboarding_template_tasks")
    .upsert([task])
    .select()
    .single();

  if (error) throw error;
  return data as OnboardingTemplateTask;
}

export async function deleteTemplateTask(id: string) {
  const { error } = await supabase!
    .from("onboarding_template_tasks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
