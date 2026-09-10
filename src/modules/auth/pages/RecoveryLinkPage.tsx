import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import logo from "../../../assets/app-logo.png";
import { verifyRecoveryToken } from "../services/authApi";

export function RecoveryLinkPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenHash = searchParams.get("token_hash")?.trim() ?? "";
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleContinue = async () => {
    if (!tokenHash || isVerifying) return;

    setErrorMessage("");
    setIsVerifying(true);
    const { error } = await verifyRecoveryToken(tokenHash);
    setIsVerifying(false);

    if (error) {
      setErrorMessage("El enlace ya no está disponible. Solicita un nuevo correo de recuperación.");
      return;
    }

    navigate("/reset-password?recovery=1", { replace: true });
  };

  return (
    <section className="login-shell">
      <div className="login-frame login-frame-single">
        <div className="login-form-panel login-form-panel-single">
          <div className="login-card recovery-link-card">
            <div className="login-brand-top login-brand-top-centered">
              <img alt="Logo JM" className="app-logo app-logo-login" src={logo} />
            </div>
            <div className="login-card-copy">
              <h2>Recuperar acceso</h2>
              <p>Presiona continuar para activar de forma segura el enlace y definir tu nueva contraseña.</p>
            </div>
            {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
            <button
              className="soft-primary-button login-button"
              type="button"
              onClick={() => void handleContinue()}
              disabled={!tokenHash || isVerifying}
            >
              {isVerifying ? "Verificando..." : "Continuar"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
