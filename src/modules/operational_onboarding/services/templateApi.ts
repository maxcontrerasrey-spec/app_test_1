import { supabase } from "../../../shared/lib/supabase";
import type {
  OnboardingTemplate,
  OnboardingTemplateInput,
  OnboardingTemplateTask,
  OnboardingTemplateTaskInput,
} from "../types";

function getClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  return supabase;
}

function readNullableText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readTemplateRecord(value: unknown): OnboardingTemplate {
  const source = (value ?? {}) as Record<string, unknown>;

  return {
    id: readText(source.id),
    name: readText(source.name),
    description: readNullableText(source.description),
    cargo: readNullableText(source.cargo),
    area: readNullableText(source.area),
    contrato: readNullableText(source.contrato),
    faena: readNullableText(source.faena),
    division: readNullableText(source.division),
    centro_costo: readNullableText(source.centro_costo),
    worker_type: readNullableText(source.worker_type),
    is_active: readBoolean(source.is_active),
    created_by: readNullableText(source.created_by),
    created_at: readText(source.created_at),
    updated_at: readText(source.updated_at),
  };
}

function readTemplateTaskRecord(value: unknown): OnboardingTemplateTask {
  const source = (value ?? {}) as Record<string, unknown>;

  return {
    id: readText(source.id),
    template_id: readText(source.template_id),
    area_responsible: readText(source.area_responsible),
    role_responsible: readNullableText(source.role_responsible),
    task_name: readText(source.task_name),
    task_description: readNullableText(source.task_description),
    is_required: readBoolean(source.is_required, true),
    is_blocking: readBoolean(source.is_blocking, true),
    requires_evidence: readBoolean(source.requires_evidence),
    evidence_type: readNullableText(source.evidence_type),
    sla_hours: source.sla_hours == null ? null : readNumber(source.sla_hours, 0),
    order_index: readNumber(source.order_index, 1),
    depends_on_task_id: readNullableText(source.depends_on_task_id),
    is_active: readBoolean(source.is_active, true),
    created_at: readText(source.created_at),
    updated_at: readText(source.updated_at),
  };
}

export async function fetchTemplates() {
  const client = getClient();
  const { data, error } = await client
    .from("onboarding_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(readTemplateRecord);
}

export async function createTemplate(template: OnboardingTemplateInput) {
  const client = getClient();
  const { data, error } = await client.rpc(
    "create_operational_onboarding_template",
    {
      p_name: template.name,
      p_description: template.description ?? null,
      p_cargo: template.cargo ?? null,
      p_area: template.area ?? null,
      p_contrato: template.contrato ?? null,
      p_faena: template.faena ?? null,
      p_division: template.division ?? null,
      p_centro_costo: template.centro_costo ?? null,
      p_worker_type: template.worker_type ?? null,
      p_is_active: template.is_active ?? false,
      p_comment: template.comment ?? null,
    },
  );

  if (error) throw error;
  return readTemplateRecord(data);
}

export async function updateTemplate(id: string, template: OnboardingTemplateInput) {
  const client = getClient();
  const { data, error } = await client.rpc(
    "update_operational_onboarding_template",
    {
      p_template_id: id,
      p_name: template.name,
      p_description: template.description ?? null,
      p_cargo: template.cargo ?? null,
      p_area: template.area ?? null,
      p_contrato: template.contrato ?? null,
      p_faena: template.faena ?? null,
      p_division: template.division ?? null,
      p_centro_costo: template.centro_costo ?? null,
      p_worker_type: template.worker_type ?? null,
      p_is_active: template.is_active ?? false,
      p_comment: template.comment ?? null,
    },
  );

  if (error) throw error;
  return readTemplateRecord(data);
}

export async function fetchTemplateTasks(templateId: string) {
  const client = getClient();
  const { data, error } = await client
    .from("onboarding_template_tasks")
    .select("*")
    .eq("template_id", templateId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(readTemplateTaskRecord);
}

export async function upsertTemplateTask(task: OnboardingTemplateTaskInput) {
  const client = getClient();
  const { data, error } = await client.rpc(
    "upsert_operational_onboarding_template_task",
    {
      p_template_id: task.template_id,
      p_task_id: task.id ?? null,
      p_area_responsible: task.area_responsible,
      p_role_responsible: task.role_responsible ?? null,
      p_task_name: task.task_name,
      p_task_description: task.task_description ?? null,
      p_is_required: task.is_required ?? true,
      p_is_blocking: task.is_blocking ?? true,
      p_requires_evidence: task.requires_evidence ?? false,
      p_evidence_type: task.evidence_type ?? null,
      p_sla_hours: task.sla_hours ?? 24,
      p_order_index: task.order_index ?? 1,
      p_depends_on_task_id: task.depends_on_task_id ?? null,
      p_is_active: task.is_active ?? true,
      p_comment: task.comment ?? null,
    },
  );

  if (error) throw error;
  return readTemplateTaskRecord(data);
}

export async function deleteTemplateTask(id: string, comment?: string | null) {
  const client = getClient();
  const { error } = await client.rpc(
    "delete_operational_onboarding_template_task",
    {
      p_task_id: id,
      p_comment: comment ?? null,
    },
  );

  if (error) throw error;
}
