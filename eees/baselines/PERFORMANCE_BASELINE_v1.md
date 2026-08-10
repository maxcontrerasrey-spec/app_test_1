---
document_id: EEES-BASELINE-PERFORMANCE-P4-V1
title: Performance Baseline P4 v1
version: 1.0.21
status: Activo
language: es-CL
owner: Quality
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Performance Baseline P4 v1

## Alcance medido

Baseline inicial de performance P4 medido desde el build productivo y smokes ejecutables. El tamano canonico corresponde al artefacto de CI con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` publicas inyectadas, igual que el despliegue. No define thresholds funcionales arbitrarios; registra el estado actual como control anti-regresion para que aumentos futuros se justifiquen con evidencia.

## Comandos ejecutados

- Build productivo: `npm run build`.
- Build instrumentado: `npm run build:frontend-check`.
- Smoke rutas criticas: `npm run smoke:frontend-routes`.
- Auditor performance: `npm run audit:performance-baseline`.

## Bundle medido

- dist total medido: 10,113,208 bytes.
- JS total medido: 2,632,397 bytes.
- `dist` total: 10,113,208 bytes.
- Archivos JS: 51.
- JS total: 2,632,397 bytes.
- Archivos CSS: 10.
- CSS total: 216,605 bytes.
- Mayor asset total: `dist/assets/fondo-D3Rn61W4.png`, 5,257,091 bytes.
- Mayor mapa: `dist/maps/chile.json`, 1,454,860 bytes.
- Mayor vendor JS: `echarts-vendor`, 512,504 bytes.
- Exportador XLSX lazy: `xlsx-vendor`, 500,059 bytes.
- Supabase vendor: `supabase-vendor`, 221,867 bytes.
- App framework: `app-framework`, 276,291 bytes (86,148 bytes gzip).

Revision 2026-07-23: el total global sube 671 bytes por el helper testeado que calcula `Tiempo Abierto` en reclutamiento desde `opened_at`. No agrega vendors, rutas lazy ni CSS; los limites especificos de JS, CSS y assets trackeados permanecen bajo baseline.

Revision 2026-07-23 CI: GitHub Actions `Audit Enterprise Guardrails` midio `JS total = 3,023,917` en el run `30047476403` con Node 24 y variables publicas de Supabase inyectadas. Se actualiza solo el limite global JS para alinear el baseline canonico al artefacto CI; vendors, CSS y assets trackeados no cambian.

Revision 2026-07-27: el total global sube 5,306 bytes y JS sube 262 bytes por el refetch defensivo del catalogo de folios destino en movilidad interna medido desde Guardian full. No agrega vendors, rutas lazy ni CSS; los assets trackeados permanecen bajo baseline.

Revision 2026-07-27 BI: el total global sube 349 bytes y JS sube 349 bytes por el indicador `Tiempo Medio de Contratacion` en BI Reclutamiento y el mapeo typed del nuevo campo RPC. No agrega vendors, rutas lazy ni CSS; los assets trackeados permanecen bajo baseline.

Revision 2026-07-27 BI cobertura: el total global sube 413 bytes y JS sube 413 bytes por reemplazar el grafico de estado por cobertura de cupos con tooltip desglosado entre contratacion y movilidad interna. No agrega vendors, rutas lazy ni CSS; los assets trackeados permanecen bajo baseline.

Revision 2026-07-27 BI jornada: el total global sube 1,182 bytes, JS sube 958 bytes y CSS sube 224 bytes por agregar el filtro Jornada en BI Reclutamiento y formatear `Tiempo Medio de Contratacion` como años, meses y dias. No agrega vendors ni rutas lazy; los assets trackeados permanecen bajo baseline.

Revision 2026-07-27 BI jornada cache: el total global sube 39 bytes y JS sube 39 bytes por incluir `shiftNames` en la query key normalizada de BI. No agrega vendors, rutas lazy ni CSS; corrige el refetch de tarjetas y graficos al cambiar Jornada.

Revision 2026-07-27 control filtros: el total global sube 2,124 bytes, JS sube 1,423 bytes y CSS sube 701 bytes por extender `MultiSelectField` con busqueda digitada y aplicar multiseleccion en filtros de Control de Contrataciones. No agrega vendors ni rutas lazy; los assets trackeados permanecen bajo baseline.

Revision 2026-07-27 BI paleta: el total global sube 312 bytes y JS sube 312 bytes por separar colores de pendientes en movilidad interna, usar rojo opaco para cupos faltantes y ordenar la etapa `Levantamiento de Contraindicación`. No agrega vendors, rutas lazy ni CSS; los assets trackeados permanecen bajo baseline.

Revision 2026-07-27 BI donas: el total global sube 786 bytes y JS sube 786 bytes por homologar las donas de Reclutamiento al estilo de Incentivos: labels truncados, leyenda inferior, separacion entre segmentos, borde redondeado, sombra suave y tooltips estructurados. No agrega vendors, rutas lazy ni CSS; los assets trackeados permanecen bajo baseline.

Revision 2026-07-27 BI jornada freshness: el total global sube 59 bytes y JS sube 59 bytes por forzar frescura del dashboard BI Reclutamiento y evitar mostrar tarjetas antiguas mientras cambia el filtro Jornada. No agrega vendors, rutas lazy ni CSS; los assets trackeados permanecen bajo baseline.

Revision 2026-07-28 BI incentivos labels: el total global sube 14 bytes y JS sube 14 bytes por mejorar la nitidez de las etiquetas dentro de barras en `Inversión por contrato`, eliminando el contorno blanco pixelado. No agrega vendors, rutas lazy ni CSS; los assets trackeados permanecen bajo baseline.

Revision 2026-07-29 BUK cupos: el total global sube 1,350 bytes y JS sube 1,350 bytes por la seleccion defensiva de `Personal a Contratar` segun cupos disponibles por caso. No agrega vendors, rutas lazy ni CSS; el control autoritativo queda en backend y los assets trackeados permanecen bajo baseline.

Revision 2026-07-30 navegacion movil: el total global sube 2,464 bytes, JS sube 38 bytes y CSS sube 2,426 bytes por convertir el topnav en una experiencia tactil en celular: header sticky, dropdown fijo sobre el contenido, scroll horizontal del nav y panel scrolleable. No agrega vendors, rutas lazy ni assets trackeados.

Revision 2026-07-30 navegacion movil reapertura: el total global sube 330 bytes, JS sube 199 bytes y CSS sube 131 bytes por renderizar el panel movil como hermano directo del header, fuera del scroller horizontal, y elevarlo sobre widgets flotantes como ORION. No agrega vendors, rutas lazy ni assets trackeados.

Revision 2026-07-30 ficha BUK obligatoria: el total global sube 189 bytes y JS sube 189 bytes por mostrar campos faltantes de la ficha del candidato y exigir tallas antes de habilitar el avance a `Listo para contratar`. No agrega vendors, rutas lazy, CSS ni assets trackeados.

Revision 2026-08-03 auditoria integral: se eliminan el generador PDF local sin consumidores, cinco lecturas duplicadas del servicio de competencias y las dependencias frontend PDF/QR asociadas. El cambio reduce 903 lineas de codigo, 642,227 bytes de `dist`, 478,046 bytes de JS y tres chunks respecto del baseline machine-readable anterior. La generacion de certificados permanece en su Edge Function con dependencias propias y el frontend conserva ECharts/XLSX lazy.

Revision 2026-08-04 Solicitud de Contratacion: el total y JS suben 13,470 bytes en la medicion canonica de Guardian full por la nueva ruta publica lazy `/verificar/documento`, su mapeo allowlist y los estados de autenticidad/conciliacion. No agrega vendors, CSS ni assets; el PDF y QR permanecen en Edge Functions. El smoke de rutas valida que el verificador sea publico sin debilitar las rutas autenticadas.

Revision 2026-08-05 seguridad frontend: el total sube 53,027 bytes y JS sube 58,887 bytes por migrar React 18.3/React Router 6.30 a React 19.2.7/React Router 8.3.0. El salto elimina todos los advisories npm del router; la ultima v7 corregia los avisos originales pero incorporaba un advisory RSC alto. El ERP mantiene modo declarativo, no agrega SSR/RSC ni rutas eager, y `app-framework` queda en 276,291 bytes minificados / 86,148 bytes gzip. Build, smoke de rutas y auditoria npm pasan.

Revision 2026-08-05 seguridad frontend CI: GitHub Actions `Audit Enterprise Guardrails` run `31066781865`, con Node 24 y variables publicas de Supabase inyectadas, midio 10,113,208 bytes totales y 2,632,397 bytes JS. Se ajustan solo los limites globales al artefacto canonico remoto; CSS y todos los vendors trackeados, incluido `app-framework`, conservan los limites medidos localmente.

Revision 2026-08-06 recuperacion Auth: el total y JS suben 1,271 bytes por conservar `code`/`status` de Supabase Auth, bloquear solicitudes concurrentes y aplicar cooldown de recuperacion ante 429. No agrega vendors, CSS ni rutas; los assets trackeados conservan sus limites.

Revision 2026-08-08 postulacion DSAL: el total sube 22,976 bytes, JS sube 9,505 bytes y CSS sube 2,908 bytes por agregar la ruta publica lazy `/postulacion-dsal`, el formulario DSAL con logo Consorcio Andino, la bandeja interna `Precandidatos` y los RPCs asociados. No agrega vendors ni assets pesados; reutiliza el logo existente de Consorcio Andino.

Revision 2026-08-08 estetica postulacion DSAL: el total sube 4,040 bytes, JS sube 1,526 bytes y CSS sube 2,514 bytes por alinear la pagina publica `/postulacion-dsal` al lenguaje visual compacto del ERP en notebook y celular. No agrega vendors ni assets; mantiene la ruta lazy y reutiliza controles globales existentes.

Revision 2026-08-08 copy postulacion DSAL: JS sube 5 bytes por reemplazar el bloque de introduccion y resumen por la bienvenida institucional solicitada. No agrega vendors, rutas ni assets.

Revision 2026-08-08 validacion DSAL: el total sube 1,117 bytes y JS sube 1,226 bytes por agregar normalizacion visible de texto, formato de telefono y validacion de correo en la pagina publica. No agrega vendors ni assets.

Revision 2026-08-08 auditoria DSAL: el total sube 419 bytes y JS sube 419 bytes por exigir folio con cupo en la aprobacion de precandidatos y mostrar la instruccion operativa cuando no hay destino habilitado. No agrega vendors, CSS ni assets.

Revision 2026-08-08 revisores y detalle DSAL: el total sube 1,866 bytes y JS sube 1,866 bytes por ampliar la autoridad del flujo a gerente de área DSAL, Director de Operaciones y Reclutamiento, además de incorporar el detalle expandible de cada precandidato. No agrega vendors, CSS ni assets.

## Rutas criticas smoke

- `/login`: carga publica validada por `smoke:frontend-routes`.
- `/postulacion-dsal`: postulacion publica DSAL, lazy y sin lectura de datos privados.
- `/verificar/documento`: verificador publico de Solicitud de Contratacion, lazy y sin datos privados.
- `/operaciones/resumen`: ruta protegida valida redirect a `/login` sin sesion.
- Resultado smoke: PASS.

## Superficie critica clasificada

- Queries costosas ya optimizadas y protegidas: `submit_service_entries_batch(jsonb)` usa preparacion set-based materializada una vez; `search` operacional BUK limita por texto y ranking antes de enriquecer.
- RPCs criticas con smokes/audits: operaciones batch, dashboard/auth routes, migraciones, seguridad Supabase, sync BUK Edge Function.
- Vendors pesados esperados fuera del entry inicial: ECharts y XLSX siguen lazy por modulo/accion; PDF/QR se generan en la Edge Function de certificados y ya no forman parte del bundle frontend.

## Control machine-readable

<!-- EEES_PERFORMANCE_BASELINE_JSON -->
```json
{
  "distTotalBytes": 10171405,
  "jsFileCount": 54,
  "jsTotalBytes": 2670269,
  "cssFileCount": 10,
  "cssTotalBytes": 226363,
  "trackedAssets": [
    { "match": "fondo-", "maxBytes": 5257091 },
    { "match": "maps/chile.json", "maxBytes": 1454860 },
    { "match": "echarts-vendor", "maxBytes": 512504 },
    { "match": "xlsx-vendor", "maxBytes": 500059 },
    { "match": "supabase-vendor", "maxBytes": 221867 },
    { "match": "app-framework", "maxBytes": 276291 }
  ]
}
```

Revision 2026-08-08 DSAL nómina y antecedentes: el total global sube 3,345 bytes, JS sube 1,951 bytes y CSS sube 1,280 bytes por integrar el autocompletado autoritativo de nómina, las burbujas judiciales y tooltips de causas en Precandidatos. No agrega vendors, rutas lazy ni assets trackeados; las tablas judiciales permanecen protegidas y el enriquecimiento ocurre solo en la RPC autenticada de revisión.

Revision 2026-08-10 sanciones como módulo propio: el total global sube 1,451 bytes, JS sube 1,450 bytes y CSS sube 1 byte por separar Sanciones en una ruta lazy y un contenedor propio fuera de Incentivos. No agrega vendors ni assets trackeados; la nueva ruta usa el módulo y guard `solicitud_sanciones`.

## Politica de actualizacion

- Si un asset trackeado supera el baseline, se debe demostrar beneficio funcional o reduccion de riesgo y actualizar este archivo en el mismo cambio.
- Si aparece un nuevo vendor pesado, debe quedar clasificado como lazy, accion especifica o deuda justificada.
- Si una ruta critica nueva se agrega al ERP, debe sumarse a smokes o quedar clasificada con owner.
