import type { OnboardingTemplate, OnboardingTemplateTask } from "../types";

export type TemplateFormState = {
  name: string;
  description: string;
  cargo: string;
  area: string;
  contrato: string;
  faena: string;
  division: string;
  centro_costo: string;
  worker_type: string;
  is_active: boolean;
  comment: string;
};

export type TaskFormState = {
  area_responsible: string;
  role_responsible: string;
  task_name: string;
  task_description: string;
  is_required: boolean;
  is_blocking: boolean;
  requires_evidence: boolean;
  evidence_type: string;
  sla_hours: string;
  is_active: boolean;
  comment: string;
};

export function buildTemplateForm(template: OnboardingTemplate): TemplateFormState {
  return {
    name: template.name,
    description: template.description ?? "",
    cargo: template.cargo ?? "",
    area: template.area ?? "",
    contrato: template.contrato ?? "",
    faena: template.faena ?? "",
    division: template.division ?? "",
    centro_costo: template.centro_costo ?? "",
    worker_type: template.worker_type ?? "",
    is_active: template.is_active,
    comment: "",
  };
}

export function buildTaskForm(task?: OnboardingTemplateTask, preferredArea?: string): TaskFormState {
  return {
    area_responsible: task?.area_responsible ?? preferredArea ?? "",
    role_responsible: task?.role_responsible ?? "",
    task_name: task?.task_name ?? "",
    task_description: task?.task_description ?? "",
    is_required: task?.is_required ?? true,
    is_blocking: task?.is_blocking ?? true,
    requires_evidence: task?.requires_evidence ?? false,
    evidence_type: task?.evidence_type ?? "",
    sla_hours: task?.sla_hours != null ? String(task.sla_hours) : "24",
    is_active: task?.is_active ?? true,
    comment: "",
  };
}

export function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeRequiredText(value: string) {
  return value.trim();
}

export function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
