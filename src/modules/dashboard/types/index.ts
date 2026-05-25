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
  title: string;
  subtitle: string;
  status_code: string;
  status_label: string;
  priority: string;
  created_at: string;
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
  alertsData: DashboardAlertItem[];
  kpisData: DashboardKpis | null;
}
