import { Link } from "react-router-dom";

export function AccessDeniedPage() {
  return (
    <section className="page">
      <div className="page-header-card">
        <h2>Sin acceso</h2>
      </div>

      <section className="info-card access-denied-card">
        <h3>Permisos insuficientes</h3>
        <p>
          Tu cuenta está autenticada, pero no tiene permisos para acceder a este
          módulo.
        </p>
        <p>
          Solicita asignación de rol o vuelve al inicio para navegar solo por las
          vistas habilitadas.
        </p>
        <Link className="soft-primary-button access-denied-button" to="/">
          Volver al inicio
        </Link>
      </section>
    </section>
  );
}
