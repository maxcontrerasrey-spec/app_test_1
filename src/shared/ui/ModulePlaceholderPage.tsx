type ModulePlaceholderPageProps = {
  title: string;
  description: string;
};

export function ModulePlaceholderPage({
  title,
  description
}: ModulePlaceholderPageProps) {
  return (
    <section className="page">
      <div className="hero-panel hero-panel-accent hero-panel-compact">
        <span className="eyebrow eyebrow-inverse">{title}</span>
        <h2>{title}</h2>
        <p className="hero-copy">{description}</p>
      </div>

      <section className="info-card module-placeholder-card">
        <h3>Módulo en preparación</h3>
        <p>
          Esta vista quedó creada dentro de la navegación principal y lista para
          conectarse a sus procesos reales cuando definamos el alcance funcional.
        </p>
      </section>
    </section>
  );
}
