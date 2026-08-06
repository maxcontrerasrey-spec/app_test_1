import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import logo from "../../../assets/app-logo.png";
import { useAuth } from "../context/AuthContext";
import {
  getPasswordResetErrorMessage,
  getSignInErrorMessage,
  isAuthRateLimitError
} from "../lib/authErrors";

const PASSWORD_RESET_COOLDOWN_SECONDS = 60;

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
  const [resetCooldownSeconds, setResetCooldownSeconds] = useState(0);
  const authRequestInFlightRef = useRef(false);

  const isSubmitEnabled = email.trim().length > 0 && password.trim().length > 0;

  useEffect(() => {
    if (resetCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResetCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resetCooldownSeconds]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    if (!isSubmitEnabled || authRequestInFlightRef.current) {
      return;
    }

    if (!isConfigured) {
      setErrorMessage("El entorno no tiene configurado el acceso a Supabase.");
      return;
    }

    authRequestInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setErrorMessage(getSignInErrorMessage(error));
      }
    } finally {
      authRequestInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMessage("");
    setInfoMessage("");

    if (authRequestInFlightRef.current || resetCooldownSeconds > 0) {
      return;
    }

    if (!isConfigured) {
      setErrorMessage("El entorno no tiene configurado el acceso a Supabase.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Ingresa tu correo corporativo para recuperar la contraseña.");
      return;
    }

    authRequestInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const { error } = await sendPasswordReset(email.trim());
      if (error) {
        if (isAuthRateLimitError(error)) {
          setResetCooldownSeconds(PASSWORD_RESET_COOLDOWN_SECONDS);
        }
        setErrorMessage(getPasswordResetErrorMessage(error));
        return;
      }

      setResetCooldownSeconds(PASSWORD_RESET_COOLDOWN_SECONDS);
      setInfoMessage(
        "Si el correo existe, recibirás un enlace para restablecer la contraseña."
      );
    } finally {
      authRequestInFlightRef.current = false;
      setIsSubmitting(false);
    }
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
            <span className="login-caption">
              Conexión segura. Usa tus credenciales autorizadas.
            </span>
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

        <div className="login-caption">
          <button
            className="login-inline-link"
            type="button"
            onClick={() => void handlePasswordReset()}
            disabled={isSubmitting || resetCooldownSeconds > 0}
          >
            {resetCooldownSeconds > 0
              ? `Recuperación solicitada · ${resetCooldownSeconds}s`
              : "¿Olvidaste tu contraseña? Recuperar acceso"}
          </button>
        </div>
      </div>
    </section>
  );
}
