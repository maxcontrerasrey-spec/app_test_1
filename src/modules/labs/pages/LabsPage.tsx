import { Suspense, lazy } from "react";
import { PageShell } from "../../../shared/ui";

const RechartsShowcase = lazy(async () => ({
  default: (await import("../components/RechartsShowcase")).RechartsShowcase
}));

export function LabsPage() {
  return (
    <PageShell>
      <style>{`
        /* USER PROVIDED E-INK CSS */
        .labs-paper-wrapper {
          --ink-bg: #f4f1e8;
          --ink-surface: #fbfaf5;
          --ink-text: #111111;
          --ink-muted: #4a4a4a;
          --ink-border: #1d1d1d;

          background:
            radial-gradient(circle at 20% 20%, rgba(0,0,0,0.035), transparent 24%),
            radial-gradient(circle at 80% 10%, rgba(0,0,0,0.025), transparent 20%),
            linear-gradient(var(--ink-bg), var(--ink-bg));
          color: var(--ink-text);
          font-family: Georgia, "Times New Roman", serif;
          filter: contrast(1.08) grayscale(1);
          
          min-height: calc(100vh - 100px);
          padding-bottom: 4rem;
        }

        .ink-paper {
          background-color: var(--ink-surface);
          border: 1.5px solid var(--ink-border);
          box-shadow: none;
          position: relative;
          overflow: hidden;
          
          max-width: 800px;
          margin: 0 auto;
          padding: 3rem 4rem;
        }

        .ink-paper::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.18;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
        }

        /* Essential text styling */
        .ink-paper h1, .ink-paper h2, .ink-paper h3 {
          color: var(--ink-text);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: 1.5rem;
          position: relative; /* Ensure it stays above the SVG noise */
          z-index: 10;
        }

        .ink-text {
          color: var(--ink-text);
          text-shadow:
            0.25px 0 #111,
            -0.25px 0 rgba(0,0,0,0.35);
          letter-spacing: 0.01em;
          position: relative;
          z-index: 10;
          line-height: 1.8;
          margin-bottom: 1.2rem;
          font-size: 1.15rem;
        }

        .ink-card {
          background: var(--ink-surface);
          border: 2px solid var(--ink-border);
          border-radius: 2px;
          padding: 1.5rem;
          position: relative;
          z-index: 10;
          margin-bottom: 1.5rem;
        }

        .ink-button {
          background: var(--ink-border);
          color: #f8f6ee;
          border: 2px solid var(--ink-border);
          border-radius: 2px;
          font-weight: 700;
          padding: 0.6rem 1.2rem;
          cursor: pointer;
          font-family: inherit;
          font-size: 1rem;
          transition: all 0.1s;
        }
        
        .ink-button:hover {
          background: #000;
        }

        .ink-button.secondary {
          background: transparent;
          color: var(--ink-text);
        }
        
        .ink-button.secondary:hover {
          background: rgba(0,0,0,0.05);
        }

        .ink-input {
          background: transparent;
          border: 1px solid var(--ink-muted);
          border-radius: 2px;
          padding: 0.6rem 1rem;
          font-family: inherit;
          font-size: 1rem;
          color: var(--ink-text);
          width: 100%;
          margin-bottom: 1rem;
        }

        .ink-input:focus {
          outline: none;
          border-color: var(--ink-text);
          border-width: 2px;
          padding: calc(0.6rem - 1px) calc(1rem - 1px);
        }

        .ink-badge {
          display: inline-block;
          border: 1px solid var(--ink-text);
          padding: 0.2rem 0.6rem;
          font-size: 0.85rem;
          border-radius: 20px;
          font-weight: bold;
          margin-right: 0.5rem;
        }

        .ink-header {
          border-bottom: 2px solid var(--ink-border);
          padding-bottom: 1rem;
          margin-bottom: 2rem;
        }
        
        /* Grid layout for playground */
        .playground-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          position: relative;
          z-index: 10;
        }
      `}</style>

      <div className="labs-paper-wrapper">
        <section className="ink-paper">
          <div className="ink-header">
            <h1 style={{ margin: 0 }}>Laboratorio: UI Tinta Electrónica</h1>
          </div>
          
          <p className="ink-text">
            Este es un entorno de pruebas utilizando el CSS de impresión plana optimizado. Observa cómo el filtro global <code>grayscale(1)</code> asegura que ningún elemento rompa la inmersión monocromática, y cómo el <code>text-shadow</code> subpíxel simula el sangrado orgánico de la tinta en el papel.
          </p>

          <h2 style={{ marginTop: '3rem' }}>Catálogo de Componentes</h2>

          <div className="playground-grid">
            {/* Botones */}
            <div className="ink-card">
              <h3 style={{ fontSize: '1.2rem', marginTop: 0 }}>Acciones (Botones)</h3>
              <p className="ink-text" style={{ fontSize: '0.95rem', color: 'var(--ink-muted)' }}>
                Diferenciación jerárquica sin depender de colores vivos.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button className="ink-button">Acción Principal</button>
                <button className="ink-button secondary">Acción Secundaria</button>
              </div>
            </div>

            {/* Entradas de Texto */}
            <div className="ink-card">
              <h3 style={{ fontSize: '1.2rem', marginTop: 0 }}>Formularios</h3>
              <label className="ink-text" style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                Nombre completo
              </label>
              <input type="text" className="ink-input" placeholder="Ej. Juan Pérez" />
              
              <label className="ink-text" style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                Comentarios
              </label>
              <textarea className="ink-input" rows={3} placeholder="Escribe aquí..."></textarea>
            </div>

            {/* Badges / Estados */}
            <div className="ink-card">
              <h3 style={{ fontSize: '1.2rem', marginTop: 0 }}>Etiquetas de Estado</h3>
              <p className="ink-text" style={{ fontSize: '0.95rem', color: 'var(--ink-muted)' }}>
                Estados representados por grosor y patrón, no por color (rojo/verde).
              </p>
              <div style={{ marginTop: '1rem' }}>
                <span className="ink-badge" style={{ backgroundColor: 'var(--ink-text)', color: 'var(--ink-surface)' }}>
                  Aprobado
                </span>
                <span className="ink-badge" style={{ borderStyle: 'dashed' }}>
                  Pendiente
                </span>
                <span className="ink-badge" style={{ color: 'var(--ink-muted)', borderColor: 'var(--ink-muted)' }}>
                  Rechazado
                </span>
              </div>
            </div>

            {/* Tarjeta de Contenido */}
            <div className="ink-card" style={{ borderStyle: 'dashed' }}>
              <h3 style={{ fontSize: '1.2rem', marginTop: 0 }}>Sub-Tarjeta (Wireframe)</h3>
              <p className="ink-text" style={{ fontSize: '0.95rem' }}>
                Al anidar tarjetas, usar bordes punteados o discontinuos ayuda a separar contenido sin usar sombras.
              </p>
              <button className="ink-button secondary" style={{ width: '100%' }}>Ver más detalles</button>
            </div>
          </div>

          <h2 style={{ marginTop: "3rem" }}>Showcase de gráficos ERP</h2>
          <p className="ink-text">
            Esta sección valida la integración compartida de Recharts dentro de la app. El objetivo no es solo visualizar un gráfico, sino confirmar lectura, responsive y consistencia visual con la capa compartida actual.
          </p>
          <Suspense fallback={<p className="ink-text">Cargando showcase de Recharts...</p>}>
            <RechartsShowcase />
          </Suspense>
          
        </section>
      </div>
    </PageShell>
  );
}
