export type OnboardingTemplate = {
  id: string;
  name: string;
  description: string | null;
  cargo: string | null;
  area: string | null;
  contrato: string | null;
  faena: string | null;
  division: string | null;
  centro_costo: string | null;
  worker_type: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingTemplateInput = {
  name: string;
  description?: string | null;
  cargo?: string | null;
  area?: string | null;
  contrato?: string | null;
  faena?: string | null;
  division?: string | null;
  centro_costo?: string | null;
  worker_type?: string | null;
  is_active?: boolean;
  comment?: string | null;
};

export type OnboardingTemplateTask = {
  id: string;
  template_id: string;
  area_responsible: string;
  role_responsible: string | null;
  task_name: string;
  task_description: string | null;
  is_required: boolean;
  is_blocking: boolean;
  requires_evidence: boolean;
  evidence_type: string | null;
  sla_hours: number | null;
  order_index: number;
  depends_on_task_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OnboardingTemplateTaskInput = {
  id?: string | null;
  template_id: string;
  area_responsible: string;
  role_responsible?: string | null;
  task_name: string;
  task_description?: string | null;
  is_required?: boolean;
  is_blocking?: boolean;
  requires_evidence?: boolean;
  evidence_type?: string | null;
  sla_hours?: number | null;
  order_index?: number;
  depends_on_task_id?: string | null;
  is_active?: boolean;
  comment?: string | null;
};

export type EmployeeOnboardingCaseStatus =
  | "draft"
  | "in_progress"
  | "waiting_external"
  | "blocked"
  | "ready_for_operation"
  | "cancelled";

export type EmployeeOnboardingCase = {
  id: string;
  employee_id: string | null;
  candidate_id: string | null;
  hiring_request_id: string | null;
  template_id: string;
  status: EmployeeOnboardingCaseStatus;
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
  created_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeOnboardingTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "rejected"
  | "not_applicable"
  | "expired";

export type EmployeeOnboardingTask = {
  id: string;
  case_id: string;
  template_task_id: string | null;
  area_responsible: string;
  owner_user_id: string | null;
  role_responsible: string | null;
  task_name: string;
  task_description: string | null;
  status: EmployeeOnboardingTaskStatus;
  is_required: boolean;
  is_blocking: boolean;
  requires_evidence: boolean;
  evidence_type: string | null;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  close_comment: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type EmployeeOnboardingEvidence = {
  id: string;
  task_id: string;
  case_id: string;
  file_name: string;
  file_path: string;
  file_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  evidence_type: string | null;
  comment: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

export type EmployeeOnboardingActivityLog = {
  id: string;
  case_id: string;
  task_id: string | null;
  action: string;
  old_value: unknown;
  new_value: unknown;
  comment: string | null;
  created_by: string | null;
  created_at: string;
};
