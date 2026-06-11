import { PageShell } from "../../../shared/ui";

export function LabsPage() {
  return (
    <PageShell>
      <style>{`
        /* FLAT PRINT E-INK STYLES */
        .labs-paper-wrapper {
          --background: #f4f1e8;
          --foreground: #111111;
          --card: #fbfaf5;
          --border: #111111;
          --muted: #5a5a5a;

          position: relative;
          min-height: calc(100vh - 100px);
          background-color: var(--background);
          color: var(--foreground);
          font-family: Georgia, serif; 
          
          /* Typography antialiasing to simulate ink spread */
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-shadow: 0 0 1px rgba(17, 17, 17, 0.1); /* Very subtle ink bleed */
          
          overflow: hidden;
          padding-bottom: 4rem;
        }

        /* SVG Noise Filter Overlay for raw paper texture */
        .labs-paper-wrapper::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          opacity: 0.25; /* Softer texture for the clean palette */
          mix-blend-mode: multiply;
          background-image: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" opacity="0.15"/%3E%3C/svg%3E');
        }

        .paper-content-panel {
          position: relative;
          z-index: 10;
          max-width: 800px;
          margin: 0 auto;
          padding: 3rem 4rem;
          background-color: var(--card);
          border: 1px solid var(--border);
          box-shadow: 4px 4px 0px var(--border) !important; /* Brutalist shadow */
          border-radius: 0px; /* Sharp edges like cut paper */
        }

        .minimal-page-header {
          border-bottom: 1px solid var(--border);
          margin-bottom: 3rem;
          padding-bottom: 1rem;
        }

        .minimal-page-header h1 {
          color: var(--foreground);
          font-weight: 800;
        }

        .paper-content-panel h1, 
        .paper-content-panel h2, 
        .paper-content-panel h3 {
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--foreground);
        }

        .paper-content-panel p {
          font-size: 1.15rem;
          line-height: 1.8;
          margin-bottom: 1.5rem;
          color: var(--foreground);
        }

        .paper-callout {
          padding: 1.5rem;
          border: 1px dashed var(--muted);
          background-color: var(--background);
          margin: 2rem 0;
          border-radius: 0px;
        }

        .paper-callout strong {
          color: var(--foreground);
          font-weight: 700;
        }

        .muted-text {
          color: var(--muted);
          font-size: 0.9rem;
        }
      `}</style>

      <div className="labs-paper-wrapper">
        <div className="minimal-page-header">
          <h1>Laboratorio de Pruebas: Efecto NXTPAPER</h1>
        </div>

        <section className="paper-content-panel">
          <h2 style={{ marginBottom: '1.5rem', fontSize: '2rem' }}>La evolución de la tinta electrónica y el confort visual</h2>
          
          <p>
            En la era digital actual, pasamos una media de 8 a 10 horas diarias frente a pantallas retroiluminadas. Este nivel de exposición a emisiones de luz directa y ondas de luz azul de alta frecuencia ha desencadenado una pandemia silenciosa de fatiga visual digital, también conocida como síndrome visual informático. Los síntomas incluyen sequedad ocular, visión borrosa, dolores de cabeza tensionales y disrupción severa de los ritmos circadianos, lo que afecta directamente la calidad del sueño.
          </p>

          <p>
            Para combatir estos efectos nocivos, empresas líderes en tecnología de visualización han estado investigando alternativas a las pantallas LCD y OLED tradicionales. El santo grial siempre ha sido la tecnología E-Ink (Tinta Electrónica), que en lugar de emitir luz desde atrás hacia los ojos del usuario, refleja la luz ambiental mediante microcápsulas llenas de pigmentos magnéticos. El resultado es un material visualmente idéntico al papel impreso, que no cansa la vista bajo el sol directo y consume una cantidad minúscula de energía, limitándose a gastar batería únicamente durante el refresco de la imagen.
          </p>

          <p>
            Sin embargo, la tinta electrónica tradicional tiene tres debilidades críticas que han limitado su adopción masiva fuera de los lectores de libros electrónicos: su tasa de refresco (frecuencia de actualización) es abismalmente lenta, generando un efecto fantasma ("ghosting") insoportable para video o navegación interactiva rápida; la reproducción de color ha sido históricamente precaria, limitada a paletas deslavadas de unos pocos miles de colores; y su legibilidad en entornos nocturnos requiere de luz frontal ("frontlight"), que rompe parcialmente el propósito de no emitir luz artificial.
          </p>

          <h3 style={{ marginTop: '2.5rem', marginBottom: '1rem', fontSize: '1.6rem' }}>El nacimiento de las pantallas híbridas: TCL NXTPAPER</h3>

          <p>
            Buscando lo mejor de ambos mundos, ingenieros optoelectrónicos desarrollaron tecnologías híbridas como NXTPAPER (TCL) o X-Paper (XPPen). A diferencia de E-Ink, estas tecnologías no utilizan microcápsulas magnéticas, sino que retienen la arquitectura base de las pantallas IPS LCD o AMOLED, que garantizan tasas de refresco fluidas (hasta 120Hz) y una reproducción de color del 100% sRGB. 
          </p>

          <p>
            El secreto de su efecto "papel" no está en los píxeles, sino en las capas que los recubren. La tecnología NXTPAPER aplica un grabado químico multicapa a escala nanométrica sobre la cubierta de cristal. Esta superficie mate anti-reflejo (AG Glass) cumple una función vital: dispersa y difumina cualquier fuente de luz externa (como el sol o una lámpara) e impide los reflejos especulares ("glare") que obligan al ojo a reenfocar constantemente, una de las principales causas de fatiga visual oculta.
          </p>

          <div className="paper-callout">
            <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1.2rem' }}>¿Sabías qué?</strong>
            Además del grabado físico, estas pantallas incorporan polarizadores de luz circulares (CPL) que transforman la luz artificial emitida por los LEDs traseros en ondas que imitan matemáticamente la dispersión de la luz solar natural, engañando al cerebro para que la perciba como luz rebotada.
          </div>

          <p>
            A nivel de software y filtrado de hardware, la luz azul (la longitud de onda más energética y dañina del espectro visible) es atenuada directamente en el diodo emisor sin distorsionar artificialmente la temperatura del color a un amarillo agresivo. Adicionalmente, el software del dispositivo ajusta la colorimetría para aplanar el contraste excesivo, imitando la reducida profundidad dinámica de la tinta CMYK real sobre celulosa.
          </p>

          <p>
            En este experimento CSS, estamos probando metodologías para emular estas complejas alteraciones físicas y ópticas utilizando únicamente estándares web (W3C), aplicando ruido SVG como nanotextura y mix-blend-modes complejos para achatar el rango dinámico de las tarjetas y fuentes. Todo ello con el fin de acercar la ergonomía visual del E-Ink a pantallas estándar.
          </p>

        </section>
      </div>
    </PageShell>
  );
}
