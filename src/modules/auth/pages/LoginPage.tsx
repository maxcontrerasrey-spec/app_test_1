import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import logo from "../../../assets/app-logo.png";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { isConfigured, sendPasswordReset, signIn } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState(
    searchParams.get("passwordReset") === "1"
      ? "Contraseña actualizada. Inicia sesión con tu nueva clave."
      : ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSubmitEnabled = email.trim().length > 0 && password.trim().length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    if (!isSubmitEnabled) {
      return;
    }

    if (!isConfigured) {
      setErrorMessage("El entorno no tiene configurado el acceso a Supabase.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage("No fue posible iniciar sesión. Revisa tus credenciales.");
    }
  };

  const handlePasswordReset = async () => {
    setErrorMessage("");
    setInfoMessage("");

    if (!isConfigured) {
      setErrorMessage("El entorno no tiene configurado el acceso a Supabase.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Ingresa tu correo corporativo para recuperar la contraseña.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await sendPasswordReset(email.trim());
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setInfoMessage(
      "Si el correo existe, recibirás un enlace para restablecer la contraseña."
    );
  };

  return (
    <section className="login-shell">
      <div className="login-glass-card">
        <div className="login-brand-top">
          <img alt="Logo JM" className="app-logo-login" src={logo} />
        </div>
        
        <div className="login-header-copy">
          <h2>Iniciar sesión</h2>
          <p>Bienvenido a la Plataforma de Control</p>
        </div>

        <form className="login-form-content" onSubmit={handleSubmit}>
          <div className="glass-input-group">
            <span className="glass-input-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <input
              className="glass-input-field"
              id="login-email"
              placeholder="Correo electrónico corporativo"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="glass-input-group">
            <span className="glass-input-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </span>
            <input
              className="glass-input-field"
              id="login-password"
              placeholder="Contraseña"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="login-actions">
            <button
              className="login-inline-link"
              type="button"
              onClick={() => void handlePasswordReset()}
              disabled={isSubmitting}
            >
              Recuperar contraseña
            </button>
          </div>

          {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
          {infoMessage ? <p className="login-success">{infoMessage}</p> : null}

          <button
            className="soft-primary-button glass-submit-button"
            type="submit"
            disabled={!isSubmitEnabled || isSubmitting}
          >
            {isSubmitting ? "Ingresando..." : "Continuar"}
          </button>
        </form>

        <p className="login-caption">
          Plataforma diseñada por <a className="login-caption-link" href="mailto:max.contrerasrey@icolud.com">Maximiliano Contreras</a>
        </p>
      </div>
    </section>
  );
}
