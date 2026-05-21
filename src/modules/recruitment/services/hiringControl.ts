import { supabase } from "../../../shared/lib/supabase";
import type { HiringWorkflowStatus } from "./hiringWorkflow";

export type HiringControlSummary = {
  pending_area_manager: number;
  pending_contracts_control: number;
  approved: number;
  rejected: number;
  total: number;
};

export type HiringControlApproval = {
  id: number;
  step_code: "contracts_control";
  step_name: string;
  hiring_request_id: string;
  approver_user_id: string | null;
  approver_name: string | null;
  approver_email: string | null;
  created_at: string;
  hiring_requests: {
    folio: string | null;
    status: HiringWorkflowStatus;
    requester_name: string | null;
    requester_email: string | null;
    contract_name: string;
    contract_number: string | null;
    job_position_name: string;
    vacancies: number | null;
    requested_entry_date: string | null;
    start_date: string | null;
    end_date: string | null;
    shift_name: string | null;
    salary_offer: number | null;
    campamento: boolean | null;
    pasajes: boolean | null;
    other_benefits: string | null;
    cost_center_code: string | null;
    cost_center_name: string | null;
  } | null;
};

export type HiringControlRequestRow = {
  id: string;
  folio: string | null;
  status: HiringWorkflowStatus;
  current_step_code: "area_manager" | "contracts_control" | null;
  requester_name: string | null;
  requester_email: string | null;
  contract_name: string;
  contract_number: string | null;
  job_position_name: string;
  vacancies: number | null;
  cost_center_code: string | null;
  cost_center_name: string | null;
  shift_name: string | null;
  salary_offer: number | null;
  campamento: boolean | null;
  pasajes: boolean | null;
  other_benefits: string | null;
  requested_entry_date: string | null;
  start_date: string | null;
  end_date: string | null;
  submitted_at: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  area_manager_status: HiringWorkflowStatus | "pending" | null;
  area_manager_approver_name: string | null;
  area_manager_decided_at: string | null;
  contracts_control_status: HiringWorkflowStatus | "pending" | null;
  contracts_control_approver_name: string | null;
  contracts_control_decided_at: string | null;
};

type HiringControlDashboardPayload = {
  summary?: HiringControlSummary | null;
  pending_contracts_control?: HiringControlApproval[] | null;
  recent_requests?: HiringControlRequestRow[] | null;
};

export async function fetchHiringControlDashboard() {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_hiring_control_dashboard");

  if (error) {
    return {
      data: null,
      error: "No fue posible cargar el tablero de Control de Contrataciones."
    };
  }

  const payload = (data ?? {}) as HiringControlDashboardPayload;

  return {
    data: {
      summary: payload.summary ?? {
        pending_area_manager: 0,
        pending_contracts_control: 0,
        approved: 0,
        rejected: 0,
        total: 0
      },
      pendingApprovals: payload.pending_contracts_control ?? [],
      recentRequests: payload.recent_requests ?? []
    },
    error: null
  };
}
