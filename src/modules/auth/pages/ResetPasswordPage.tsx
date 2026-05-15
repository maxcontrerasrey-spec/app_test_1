import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import logo from "../../../assets/app-logo.png";
import { useAuth } from "../context/AuthContext";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { isConfigured, isLoading, isRecoveryMode, updatePassword, signOut, user } =
    useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit =
    password.trim().length >= 8 &&
    confirmPassword.trim().length >= 8 &&
    !isSubmitting;

  if (isConfigured && !isLoading && user && !isRecoveryMode) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!isConfigured) {
      setErrorMessage("Supabase no está configurado en este entorno.");
      return;
    }

    if (!isRecoveryMode) {
      setErrorMessage(
        "El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo."
      );
      return;
    }

    if (password.trim().length < 8) {
      setErrorMessage("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage("No fue posible actualizar la contraseña.");
      return;
    }

    setSuccessMessage("Contraseña actualizada. Inicia sesión nuevamente.");
    await signOut();
    navigate("/login?passwordReset=1", { replace: true });
  };

  return (
    <section className="login-shell">
      <div className="login-frame login-frame-single">
        <div className="login-form-panel login-form-panel-single">
          <form className="login-card" onSubmit={handleSubmit}>
            <div className="login-brand-top login-brand-top-centered">
              <img alt="Logo JM" className="app-logo app-logo-login" src={logo} />
            </div>

            <div className="login-card-copy">
              <h2>Restablecer contraseña</h2>
              <p>
                Define una nueva contraseña segura para tu cuenta corporativa.
              </p>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="reset-password">
                Nueva contraseña
              </label>
              <input
                className="text-field"
                id="reset-password"
                placeholder="Minimo 8 caracteres"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="reset-password-confirm">
                Confirmar contraseña
              </label>
              <input
                className="text-field"
                id="reset-password-confirm"
                placeholder="Repite la nueva contraseña"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
            {successMessage ? <p className="login-success">{successMessage}</p> : null}

            <button
              className="soft-primary-button login-button"
              type="submit"
              disabled={!canSubmit}
            >
              {isSubmitting ? "Actualizando..." : "Guardar nueva contraseña"}
            </button>

            <Link className="login-inline-link" to="/login">
              Volver a inicio de sesión
            </Link>
          </form>
        </div>
      </div>
    </section>
  );
}
