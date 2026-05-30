import type { WhoApprovalCause } from "../../recruitment/services/hiringControl";

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
  case_candidate_id?: string | null;
  step_code?: string | null;
  step_name?: string | null;
  hiring_request_id?: string | null;
  folio?: string | null;
  candidate_name?: string | null;
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
  approval_comment?: string | null;
  requested_by_name?: string | null;
  who_causes?: WhoApprovalCause[] | null;
  title?: string;
  subtitle?: string;
  status_code: string;
  status_label: string;
  priority: string;
  created_at: string;
}

export interface DashboardApprovalTrackingItem {
  id: string;
  type?: string;
  approval_id?: number | null;
  hiring_request_id?: string | null;
  folio?: string | null;
  case_candidate_id?: string | null;
  candidate_name?: string | null;
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
  approval_comment?: string | null;
  requested_by_name?: string | null;
  who_causes?: WhoApprovalCause[] | null;
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

export interface DashboardBirthdayItem {
  id: string;
  buk_employee_id: string;
  full_name: string;
  job_title: string | null;
  birth_date: string;
  birthday_label: string;
  days_until: number;
}

export interface DashboardWeatherContext {
  zone_name: string | null;
  primary_contract_code: string | null;
  primary_contract_name: string | null;
  contract_count: number;
}

export interface DashboardDataBundle {
  tasksData: DashboardTaskItem[];
  approvalTrackingData: DashboardApprovalTrackingItem[];
  activeFoliosData: DashboardActiveFolioItem[];
  birthdaysData?: DashboardBirthdayItem[];
  weatherContext?: DashboardWeatherContext | null;
}
