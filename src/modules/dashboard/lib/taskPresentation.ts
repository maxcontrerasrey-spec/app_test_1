import type { DashboardTaskItem } from "../types";

export type DashboardNotificationPreviewItem =
  | DashboardTaskItem
  | {
      id: "grouped-incentives";
      kind: "incentive_summary";
      folio: "Incentivos Extraordinarios";
      title: string;
      status_label: "Requiere aprobación";
      module_code: "recursos_humanos";
      incentiveCount: number;
    };

export function isHumanResourcesTask(task: DashboardTaskItem) {
  return task.type === "hr_incentive_approval" || task.module_code === "recursos_humanos";
}

export function filterHomeTasks(tasks: DashboardTaskItem[]) {
  return tasks.filter((task) => !isHumanResourcesTask(task));
}

export function buildNotificationPreview(tasks: DashboardTaskItem[]): DashboardNotificationPreviewItem[] {
  const incentives = tasks.filter(isHumanResourcesTask);
  const others = tasks.filter((task) => !isHumanResourcesTask(task));

  if (incentives.length === 0) {
    return others;
  }

  return [
    {
      id: "grouped-incentives",
      kind: "incentive_summary",
      folio: "Incentivos Extraordinarios",
      title: `${incentives.length} solicitudes pendientes de aprobar`,
      status_label: "Requiere aprobación",
      module_code: "recursos_humanos",
      incentiveCount: incentives.length
    },
    ...others
  ];
}

export function isIncentiveSummaryItem(
  item: DashboardNotificationPreviewItem
): item is Extract<DashboardNotificationPreviewItem, { kind: "incentive_summary" }> {
  return "kind" in item && item.kind === "incentive_summary";
}

export function resolveTaskNavigationPath(task: DashboardNotificationPreviewItem) {
  if (task.module_code === "movilidad_interna") {
    return "/movilidad-interna";
  }

  if (task.module_code === "recursos_humanos") {
    return "/recursos-humanos/incentivos";
  }

  return "/control-contrataciones";
}

export function buildTaskSummary(task: DashboardNotificationPreviewItem) {
  if (isIncentiveSummaryItem(task)) {
    return task.title;
  }

  if (task.type === "who_approval") {
    return task.candidate_name
      ? `${task.candidate_name} · ${task.job_position_name ?? "Who pendiente"}`
      : "Aprobación Who pendiente";
  }

  if (task.module_code === "movilidad_interna") {
    return task.employee_name
      ? `${task.employee_name} · ${task.destination_area_name ?? "Movilidad interna"}`
      : "Movilidad interna pendiente";
  }

  if (task.module_code === "recursos_humanos") {
    return task.employee_name
      ? `${task.employee_name} · ${task.title ?? task.job_position_name ?? "Incentivo pendiente"}`
      : task.title ?? task.job_position_name ?? "Aprobación de incentivo pendiente";
  }

  return task.job_position_name ?? task.title ?? "Aprobación pendiente";
}
