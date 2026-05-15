import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import logo from "../../../assets/app-logo.png";
import recruitingIcon from "../../../assets/recruiting-icon.png";
import certificationIcon from "../../../assets/certification-icon.png";
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
      setErrorMessage("No fue posible enviar el correo de recuperación.");
      return;
    }

    setInfoMessage(
      "Si el correo existe, recibirás un enlace para restablecer la contraseña."
    );
  };

  return (
    <section className="login-shell">
      <div className="login-frame">
        <div className="login-brand-panel">
          <div className="login-brand-top">
            <img alt="Logo JM" className="app-logo app-logo-login" src={logo} />
          </div>

          <div className="login-brand-copy">
            <h1>Plataforma de Control</h1>
            <div className="login-brand-copy-spacer" aria-hidden="true" />
          </div>

          <ul className="login-benefits">
            <li className="login-benefit-with-image">
              <span className="login-benefit-icon-wrap" aria-hidden="true">
                <img
                  alt=""
                  className="login-benefit-icon-image"
                  src={recruitingIcon}
                />
              </span>
              Solicitud, control y seguimiento de procesos de reclutamiento y
              selección de personal
            </li>
            <li className="login-benefit-with-image">
              <span className="login-benefit-icon-wrap" aria-hidden="true">
                <img
                  alt=""
                  className="login-benefit-icon-image"
                  src={certificationIcon}
                />
              </span>
              Gestión, control y seguimiento del proceso de certificación por
              competencias
            </li>
            <li>Tu equipo ahorra tiempo con software integrado y facil de usar.</li>
            <li>Experiencia consistente y profesional en todo momento.</li>
          </ul>

          <p className="login-brand-footer">
            Somos especialistas en faenas mineras. Conectamos colaboradores entre V y
            II region.
          </p>
        </div>

        <div className="login-form-panel">
          <form className="login-card" onSubmit={handleSubmit}>
            <div className="login-card-copy">
              <h2>Iniciar sesion</h2>
              <div className="login-card-copy-spacer" aria-hidden="true" />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="login-email">
                Correo corporativo
              </label>
              <input
                className="text-field"
                id="login-email"
                placeholder="nombre.apellido@empresa.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="login-password">
                Contrasena
              </label>
              <input
                className="text-field"
                id="login-password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
            {infoMessage ? <p className="login-success">{infoMessage}</p> : null}

            <button
              className="login-inline-link"
              type="button"
              onClick={() => void handlePasswordReset()}
              disabled={isSubmitting}
            >
              Recuperar o reiniciar contraseña
            </button>

            <button
              className="soft-primary-button login-button"
              type="submit"
              disabled={!isSubmitEnabled || isSubmitting}
            >
              {isSubmitting ? "Ingresando..." : "Continuar"}
            </button>

            <p className="login-helper-text">
              Conexion segura. Usa tus credenciales autorizadas.
            </p>
          </form>

          <p className="login-caption">
            Diseñada para mejorar nuestros timpos y procesos.
          </p>
        </div>
      </div>
    </section>
  );
}
