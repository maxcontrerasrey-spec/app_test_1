import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError } from "../lib/lazyWithRetry";
import { logger } from "../lib/logger";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

function getReadableMessage(error: unknown) {
  if (isChunkLoadError(error)) {
    return "No fue posible cargar el módulo solicitado. Esto puede ocurrir por una conexión inestable o por una actualización reciente. Recarga la app para reintentar.";
  }

  if (!(error instanceof Error)) {
    return "Ocurrió un error inesperado en la interfaz.";
  }

  const message = error.message.trim();
  if (!message) {
    return "Ocurrió un error inesperado en la interfaz.";
  }

  return message;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: ""
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: getReadableMessage(error)
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    logger.error("AppErrorBoundary", {
      error,
      componentStack: errorInfo.componentStack
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section className="auth-loading-screen">
        <div className="auth-loading-card" style={{ maxWidth: "32rem" }}>
          <strong>Error al cargar el módulo</strong>
          <span>{this.state.errorMessage}</span>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="soft-primary-button approval-button-approve"
              onClick={this.handleReload}
            >
              Recargar app
            </button>
            <button
              type="button"
              className="soft-primary-button"
              onClick={this.handleGoHome}
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </section>
    );
  }
}
