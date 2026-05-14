import { Link } from "react-router-dom";
import logo from "../../../assets/app-logo.png";
import recruitingIcon from "../../../assets/recruiting-icon.png";
import certificationIcon from "../../../assets/certification-icon.png";

export function LoginPage() {
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
          <div className="login-card">
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
                placeholder="nombre.apellido@busesjm.cl"
                type="email"
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
              />
            </div>

            <button className="soft-primary-button login-button" type="button">
              Continuar
            </button>

            <p className="login-helper-text">
              Conexion segura. Usa tus credenciales de Buses JM.
            </p>

            <Link className="login-link" to="/">
              Entrar a la plataforma
            </Link>
          </div>

          <p className="login-caption">
            Diseñada para mejorar nuestros timpos y procesos.
          </p>
        </div>
      </div>
    </section>
  );
}
