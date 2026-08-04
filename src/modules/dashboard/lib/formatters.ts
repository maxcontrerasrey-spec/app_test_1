import { formatRequestDate } from "../../../shared/lib/format";

export function formatDashboardDate(dateStr: string | null | undefined) {
  return formatRequestDate(dateStr) || "—";
}

export function formatDashboardDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
