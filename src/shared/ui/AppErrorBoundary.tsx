import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "../lib/logger";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

function getReadableMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Ocurrió un error inesperado en la interfaz.";
  }

  const message = error.message.trim();
  if (!message) {
    return "Ocurrió un error inesperado en la interfaz.";
  }

  if (
    message.toLowerCase().includes("failed to fetch dynamically imported module") ||
    message.toLowerCase().includes("loading chunk") ||
    message.toLowerCase().includes("importing a module script failed")
  ) {
    return "El módulo solicitado quedó desactualizado después de una publicación. Recarga la app para sincronizar la versión activa.";
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
