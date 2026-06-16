import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export function AupPolicyModal() {
  const { acceptAupPolicy, displayName, signOut } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsAccepting(true);
    setErrorMessage(null);

    const { error } = await acceptAupPolicy();

    if (error) {
      setErrorMessage(error);
      setIsAccepting(false);
      return;
    }

    setIsAccepting(false);
  };

  return (
    <div className="aup-modal-backdrop" role="presentation">
      <section
        aria-labelledby="aup-modal-title"
        aria-modal="true"
        className="aup-modal-card"
        role="dialog"
      >
        <div className="aup-modal-kicker">Firma digital requerida</div>
        <header className="aup-modal-header">
          <div>
            <h2 id="aup-modal-title">Política de Uso Aceptable y Confidencialidad</h2>
            <p>ISO 27001 · Aplicable a todo usuario autenticado del ERP</p>
          </div>
          <span className="aup-modal-badge">Bloqueante</span>
        </header>

        <div className="aup-modal-body" tabIndex={0}>
          <p>
            Al utilizar este ERP, usted tiene acceso a información clasificada como{" "}
            <strong>Sensible y/o Confidencial</strong>, incluyendo datos personales, rentas,
            historiales de movilidad y causas Who.
          </p>

          <div className="aup-policy-box">
            <strong>Se prohíbe estrictamente:</strong>
            <ol>
              <li>Divulgar, copiar, descargar o reenviar esta información a terceros no autorizados.</li>
              <li>Utilizar los datos extraídos para fines distintos a sus funciones.</li>
              <li>Compartir sus credenciales de acceso.</li>
            </ol>
          </div>

          <p>
            En cumplimiento de la norma ISO 27001, <strong>toda actividad en el sistema está sujeta
            a monitoreo mediante registros inalterables.</strong>
          </p>

          <p>
            El incumplimiento de esta política derivará en el bloqueo de acceso y posibles sanciones
            estipuladas en el RIOHS o acciones legales. Al hacer clic en aceptar, usted confirma haber
            leído, comprendido y aceptado estas normas.
          </p>
        </div>

        <div className="aup-modal-confirmation">
          <strong>{displayName}</strong>
          <span>La aceptación quedará registrada como firma digital de esta sesión.</span>
        </div>

        {errorMessage ? (
          <p className="aup-modal-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <footer className="aup-modal-actions">
          <button
            className="soft-primary-button soft-primary-button-neutral"
            disabled={isAccepting}
            onClick={() => void signOut()}
            type="button"
          >
            Cerrar sesión
          </button>
          <button
            className="soft-primary-button soft-primary-button-success"
            disabled={isAccepting}
            onClick={() => void handleAccept()}
            type="button"
          >
            {isAccepting ? "Registrando..." : "Aceptar y Continuar"}
          </button>
        </footer>
      </section>
    </div>
  );
}
