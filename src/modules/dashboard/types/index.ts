export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface DashboardWidget {
  id: string;
  name: string;
  component_key: string;
  allowed_roles: string[];
  default_position: number;
  is_active: boolean;
}

export interface UserWidgetPreference {
  user_id: string;
  widget_id: string;
  position: number;
  hidden: boolean;
  size: WidgetSize;
}

export interface DashboardNotification {
  id: string;
  user_id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string | null;
  is_read: boolean;
  created_at: string;
}

// Interfaz combinada para el frontend
export interface ResolvedWidget extends DashboardWidget {
  position: number;
  hidden: boolean;
  size: WidgetSize;
}

export interface DashboardTaskItem {
  id: string;
  type: string;
  approval_id?: number | null;
  step_code?: string | null;
  step_name?: string | null;
  hiring_request_id?: string | null;
  folio?: string | null;
  job_position_name?: string | null;
  contract_name?: string | null;
  cost_center_code?: string | null;
  requested_vacancies?: number | null;
  candidate_count?: number | null;
  ready_candidates?: number | null;
  requester_name?: string | null;
  requester_email?: string | null;
  requested_income_date?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  shift_code?: string | null;
  salary_liquid?: number | null;
  camp_required?: boolean | null;
  flight_tickets_required?: boolean | null;
  travel_methodology?: string | null;
  other_benefits?: string | null;
  title?: string;
  subtitle?: string;
  status_code: string;
  status_label: string;
  priority: string;
  created_at: string;
}

export interface DashboardApprovalTrackingItem {
  id: string;
  approval_id?: number | null;
  hiring_request_id?: string | null;
  folio?: string | null;
  job_position_name?: string | null;
  contract_name?: string | null;
  cost_center_code?: string | null;
  requested_vacancies?: number | null;
  requester_name?: string | null;
  requester_email?: string | null;
  requested_income_date?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  shift_code?: string | null;
  salary_liquid?: number | null;
  camp_required?: boolean | null;
  flight_tickets_required?: boolean | null;
  travel_methodology?: string | null;
  other_benefits?: string | null;
  current_step_code?: string | null;
  current_step_name?: string | null;
  current_approver_name?: string | null;
  current_approver_email?: string | null;
  status_code: string;
  status_label: string;
  created_at: string;
}

export interface DashboardActiveFolioItem {
  id: string;
  case_code: string;
  status: string;
  requested_vacancies: number;
  filled_vacancies: number;
  title: string;
  contract_name: string;
  job_position_name: string;
  cost_center_code: string;
  cost_center_name: string;
  requested_entry_date: string | null;
  target_close_date: string | null;
  opened_at: string;
  requester_name: string | null;
  requester_email: string | null;
  owner_name: string | null;
  owner_user_id: string | null;
  candidate_count: number;
  ready_candidates: number;
  hired_candidates: number;
}

export interface DashboardAlertItem {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  source: string;
  created_at: string;
}

export interface DashboardKpis {
  total_vacancies: number;
  active_cases: number;
  pending_approvals: number;
  ready_to_hire_cases: number;
  expiring_documents: number;
}

export interface DashboardDataBundle {
  tasksData: DashboardTaskItem[];
  approvalTrackingData: DashboardApprovalTrackingItem[];
  activeFoliosData: DashboardActiveFolioItem[];
  alertsData: DashboardAlertItem[];
  kpisData: DashboardKpis | null;
}
