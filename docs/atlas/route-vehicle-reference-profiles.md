# Perfiles de referencia para el planificador de rutas Atlas

La lista visible del planificador se limita a **Bus**, **Taxibus** y **Minibus**. Las etiquetas históricas activas de flota (por ejemplo `BUS 1 PISO`, `TAXI -BUS` y `MINI BUS`) se normalizan a esas categorías para guardar rutas y comparar el equipo asignado.

Los valores transmitidos a Valhalla son perfiles de referencia por categoría; no sustituyen la ficha técnica individual de cada unidad. El perfil de acceso empleado es `bus` para las tres clases, y las dimensiones se envían como opciones de costo.

| Categoría | Modelo de referencia | Largo | Ancho | Alto | Peso bruto |
| --- | --- | ---: | ---: | ---: | ---: |
| Bus | Mercedes-Benz O 500 RS 2045/30 | 13,2 m | 2,6 m | 4,0 m* | 20 t |
| Taxibus | Mercedes-Benz LO 916 | 9,2 m | 2,4 m* | 3,5 m* | 9,4 t |
| Minibus | Mercedes-Benz Sprinter Pasaje 517 CDI 19+1 | 7,367 m | 2,02 m | 2,874 m | 5 t |

`*` En la ficha consultada no aparece la dimensión exterior carrozada correspondiente. Se usa una envolvente de referencia y queda marcada como tal en el código y en la interfaz; hay que sustituirla por la medida confirmada de la unidad/carrocería cuando el padrón individual disponga de ese dato.

El O 500 RS tiene carrozado máximo publicado de 14 m. La ficha muestra además un radio de giro de 24,9 m pared a pared y 20,6 m guía a guía para una carrocería de 13,2 × 2,6 m. El perfil conservador de ruta usa el largo de referencia de 13,2 m de esa configuración. El planificador no traduce el radio de giro a una restricción del motor; conserva la detección/reevaluación de giros en U y advertencias.

## Fuentes técnicas

- Kaufmann Chile, [ficha técnica Mercedes-Benz O 500 RS 2045/30 (noviembre de 2025)](https://www.kaufmann.cl/documents/68916/5685843/RS_2045_Euro%2BVI_V3-23122025.pdf/7a0054f7-61af-f20c-18aa-daca7782bce8?t=1767013502280). Publica el máximo carrozado, PBV y el radio de giro de la configuración 13,2 × 2,6 m.
- Kaufmann Chile, [ficha técnica Mercedes-Benz LO 916 Euro VI (septiembre de 2025)](https://www.kaufmann.cl/documents/68916/166123/LO%2B916%2BEuro%2BVI%2B1.pdf/e0a20c1d-7332-1a31-0833-87a891491984?t=1772463803114). Publica largo máximo carrozado de 9,2 m y PBV de 9,4 t; el ancho y alto carrozados no quedaron legibles como cifras en la ficha consultada.
- Kaufmann Chile, [ficha técnica Mercedes-Benz Sprinter 517 CDI 19+1 4×2 AT Euro VI](https://www.kaufmann.cl/documents/d/guest/06_pas_new_sprinter_517_cdi_191_at_v2_-03122025). Es la variante de pasajeros usada como referencia. La copia disponible publica 5 t PBV; para dimensiones exteriores se usa la configuración extra larga/techo alto del catálogo técnico, por lo que deben contrastarse con el padrón local antes de tratarse como datos de una unidad.

Las fichas PDF se consultaron mediante el sitio oficial del distribuidor. El acceso de descarga directa desde el entorno de ejecución devolvió HTTP 403, por lo que no se guardan copias dentro del repositorio.

## Alcance del cálculo vial

Valhalla documenta el perfil `bus` como un perfil que considera acceso de bus, y documenta `height`, `width`, `length` y `weight` entre sus opciones de costo. Eso permite enviar la configuración dimensional de referencia. La cobertura efectiva depende de que el grafo de OpenStreetMap contenga restricciones de gálibo/peso correctas; tampoco convierte un valor de radio de giro en una simulación de maniobrabilidad.

Fuente: [Valhalla Route API, modelos y opciones de costo](https://valhalla.github.io/valhalla/api/route/api-reference/).
