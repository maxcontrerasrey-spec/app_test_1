const DEFAULT_SIMULATION_ERROR = "No fue posible iniciar la simulación del conductor.";

/** Keeps useful provider/WASM errors visible even when Ferrostar rejects with a string or object. */
export function formatDriverSimulationError(reason: unknown): string {
  let message = "";
  if (reason instanceof Error) message = reason.message;
  else if (typeof reason === "string") message = reason;
  else if (reason && typeof reason === "object") {
    const candidate = reason as { message?: unknown; error?: unknown; code?: unknown };
    const detail = [candidate.message, candidate.error, candidate.code].find((value) => typeof value === "string" && value.trim());
    if (typeof detail === "string") message = detail;
  }

  const normalized = message.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
  return normalized || DEFAULT_SIMULATION_ERROR;
}
