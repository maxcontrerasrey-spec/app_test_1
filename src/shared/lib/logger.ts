type LogLevel = "error" | "warn";

const isDevelopment = import.meta.env.DEV;

function emit(level: LogLevel, scope: string, error?: unknown) {
  const prefix = `[${scope}]`;

  if (isDevelopment) {
    if (level === "error") {
      console.error(prefix, error);
      return;
    }

    console.warn(prefix, error);
    return;
  }

  const fallbackMessage = level === "error" ? "Error de servicio." : "Advertencia operativa.";
  if (level === "error") {
    console.error(`${prefix} ${fallbackMessage}`);
    return;
  }

  console.warn(`${prefix} ${fallbackMessage}`);
}

export const logger = {
  error(scope: string, error?: unknown) {
    emit("error", scope, error);
  },
  warn(scope: string, error?: unknown) {
    emit("warn", scope, error);
  }
};
