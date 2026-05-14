export function HomePage() {
  return (
    <section className="page">
      <div className="hero-panel hero-panel-accent">
        <span className="eyebrow eyebrow-inverse">Plataforma JM</span>
        <h2>Una plataforma interna para operar, controlar y escalar procesos</h2>
        <p className="hero-copy">
          Centraliza solicitudes, seguimientos y automatizaciones bajo una experiencia
          uniforme, clara y preparada para integrarse con Microsoft 365.
        </p>
      </div>

      <div className="card-grid">
        <article className="info-card">
          <h3>Operacion Unificada</h3>
          <p>Solicitudes, controles y trazabilidad en un solo entorno de trabajo.</p>
        </article>

        <article className="info-card">
          <h3>Power Platform Ready</h3>
          <p>Preparada para autenticacion Microsoft 365, SharePoint y Power Automate.</p>
        </article>

        <article className="info-card">
          <h3>Diseno Consistente</h3>
          <p>Una linea visual institucional para que cada modulo se sienta parte del mismo sistema.</p>
        </article>
      </div>
    </section>
  );
}
