import { PageShell } from "../../../shared/ui";

export function LabsPage() {
  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Laboratorio de Pruebas: Efecto NXTPAPER</h1>
      </div>

      <section className="white-panel" style={{ padding: '2rem 3rem', maxWidth: '800px', margin: '0 auto', fontSize: '1.1rem', lineHeight: '1.8' }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '2rem' }}>La evolución de la tinta electrónica y el confort visual</h2>
        
        <p style={{ marginBottom: '1.2rem' }}>
          En la era digital actual, pasamos una media de 8 a 10 horas diarias frente a pantallas retroiluminadas. Este nivel de exposición a emisiones de luz directa y ondas de luz azul de alta frecuencia ha desencadenado una pandemia silenciosa de fatiga visual digital, también conocida como síndrome visual informático. Los síntomas incluyen sequedad ocular, visión borrosa, dolores de cabeza tensionales y disrupción severa de los ritmos circadianos, lo que afecta directamente la calidad del sueño.
        </p>

        <p style={{ marginBottom: '1.2rem' }}>
          Para combatir estos efectos nocivos, empresas líderes en tecnología de visualización han estado investigando alternativas a las pantallas LCD y OLED tradicionales. El santo grial siempre ha sido la tecnología E-Ink (Tinta Electrónica), que en lugar de emitir luz desde atrás hacia los ojos del usuario, refleja la luz ambiental mediante microcápsulas llenas de pigmentos magnéticos. El resultado es un material visualmente idéntico al papel impreso, que no cansa la vista bajo el sol directo y consume una cantidad minúscula de energía, limitándose a gastar batería únicamente durante el refresco de la imagen.
        </p>

        <p style={{ marginBottom: '1.2rem' }}>
          Sin embargo, la tinta electrónica tradicional tiene tres debilidades críticas que han limitado su adopción masiva fuera de los lectores de libros electrónicos: su tasa de refresco (frecuencia de actualización) es abismalmente lenta, generando un efecto fantasma ("ghosting") insoportable para video o navegación interactiva rápida; la reproducción de color ha sido históricamente precaria, limitada a paletas deslavadas de unos pocos miles de colores; y su legibilidad en entornos nocturnos requiere de luz frontal ("frontlight"), que rompe parcialmente el propósito de no emitir luz artificial.
        </p>

        <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem' }}>El nacimiento de las pantallas híbridas: TCL NXTPAPER</h3>

        <p style={{ marginBottom: '1.2rem' }}>
          Buscando lo mejor de ambos mundos, ingenieros optoelectrónicos desarrollaron tecnologías híbridas como NXTPAPER (TCL) o X-Paper (XPPen). A diferencia de E-Ink, estas tecnologías no utilizan microcápsulas magnéticas, sino que retienen la arquitectura base de las pantallas IPS LCD o AMOLED, que garantizan tasas de refresco fluidas (hasta 120Hz) y una reproducción de color del 100% sRGB. 
        </p>

        <p style={{ marginBottom: '1.2rem' }}>
          El secreto de su efecto "papel" no está en los píxeles, sino en las capas que los recubren. La tecnología NXTPAPER aplica un grabado químico multicapa a escala nanométrica sobre la cubierta de cristal. Esta superficie mate anti-reflejo (AG Glass) cumple una función vital: dispersa y difumina cualquier fuente de luz externa (como el sol o una lámpara) e impide los reflejos especulares ("glare") que obligan al ojo a reenfocar constantemente, una de las principales causas de fatiga visual oculta.
        </p>

        <div style={{ padding: '1.5rem', backgroundColor: '#f0f0f0', borderRadius: '8px', margin: '2rem 0' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>¿Sabías qué?</strong>
          Además del grabado físico, estas pantallas incorporan polarizadores de luz circulares (CPL) que transforman la luz artificial emitida por los LEDs traseros en ondas que imitan matemáticamente la dispersión de la luz solar natural, engañando al cerebro para que la perciba como luz rebotada.
        </div>

        <p style={{ marginBottom: '1.2rem' }}>
          A nivel de software y filtrado de hardware, la luz azul (la longitud de onda más energética y dañina del espectro visible) es atenuada directamente en el diodo emisor sin distorsionar artificialmente la temperatura del color a un amarillo agresivo. Adicionalmente, el software del dispositivo ajusta la colorimetría para aplanar el contraste excesivo, imitando la reducida profundidad dinámica de la tinta CMYK real sobre celulosa.
        </p>

        <p style={{ marginBottom: '1.2rem' }}>
          En este experimento CSS, estamos probando metodologías para emular estas complejas alteraciones físicas y ópticas utilizando únicamente estándares web (W3C), aplicando ruido SVG como nanotextura y mix-blend-modes complejos para achatar el rango dinámico de las tarjetas y fuentes. Todo ello con el fin de acercar la ergonomía visual del E-Ink a pantallas estándar.
        </p>

      </section>
    </PageShell>
  );
}
