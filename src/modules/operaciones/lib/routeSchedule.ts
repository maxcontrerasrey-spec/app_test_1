type RouteStop = { stop_order: number; label: string };

/** Uses the persisted route order to expose the operational start and endpoint. */
export function getRouteEndpoints(stops: readonly RouteStop[] | null | undefined) {
  const ordered = [...(stops ?? [])].sort((a, b) => a.stop_order - b.stop_order);
  return {
    origin: ordered[0]?.label.trim() ?? "",
    destination: ordered[ordered.length - 1]?.label.trim() ?? ""
  };
}

/** Adds a route's driving duration to a local datetime-local value, rounding up to a minute. */
export function estimateLocalRouteEnd(startLocal: string, durationSeconds: number | null | undefined): string {
  if (!startLocal || durationSeconds === null || durationSeconds === undefined || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return "";
  const start = new Date(`${startLocal}:00`);
  if (!Number.isFinite(start.getTime())) return "";

  start.setSeconds(start.getSeconds() + Math.ceil(durationSeconds / 60) * 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
}
