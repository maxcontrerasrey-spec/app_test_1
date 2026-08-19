---
document_id: EEES-BASELINE-PERFORMANCE-P4-V1
title: Performance Baseline P4 v1
version: 1.0.29
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

Revision 2026-08-17 Psych AI V6.3: el artefacto canonico de GitHub Actions sube 281 bytes totales y 281 bytes JS por el contrato de homologaciones funcionales y guardrails metodologicos. No agrega vendors, CSS ni assets trackeados.

Revision 2026-08-11 representantes sindicales DSAL: el total sube 634 bytes, JS sube 288 bytes y CSS sube 346 bytes por exponer desde el RPC la marca de nómina sindical y mostrar la burbuja `Representante sindical` solo para los RUT coincidentes. No agrega vendors, rutas ni assets pesados.

Revision 2026-08-08 auditoria DSAL: el total sube 419 bytes y JS sube 419 bytes por exigir folio con cupo en la aprobacion de precandidatos y mostrar la instruccion operativa cuando no hay destino habilitado. No agrega vendors, CSS ni assets.

Revision 2026-08-08 revisores y detalle DSAL: el total sube 1,866 bytes y JS sube 1,866 bytes por ampliar la autoridad del flujo a gerente de área DSAL, Director de Operaciones y Reclutamiento, además de incorporar el detalle expandible de cada precandidato. No agrega vendors, CSS ni assets.

Revision 2026-08-14 Psych AI V5: el total global sube 1,780 bytes, JS sube 1,521 bytes y CSS sube 259 bytes por reconstruir la salida metodologica del informe psicolaboral integrado, schema V5 y secciones de revisión profesional. No agrega vendors ni assets trackeados; el cambio permanece en el módulo lazy Gestión Psicolaboral y Edge Functions.

Revision 2026-08-14 Psych AI V5 CI: GitHub Actions `Audit Enterprise Guardrails` run `31770394443`, con Node 24 y variables publicas de Supabase inyectadas, midio 10,254,698 bytes totales y 2,739,884 bytes JS. Se ajustan solo los limites globales al artefacto canonico remoto; CSS, vendors y assets trackeados permanecen bajo los limites medidos.

Revision 2026-08-14 Psych AI V5.2 CI: GitHub Actions `Audit Enterprise Guardrails` run `31774292713`, con Node 24 y variables publicas de Supabase inyectadas, midio 10,254,972 bytes totales y 2,740,158 bytes JS. Se ajustan solo los limites globales al artefacto canonico remoto por telemetria V5.2 y UI de revision; CSS, vendors y assets trackeados permanecen bajo los limites medidos.

Revision 2026-08-14 Psych AI V5.3 Luna: CSS sube a 240,482 bytes por mostrar la recomendacion preliminar, brechas, fortalezas y dudas criticas en tarjetas editables del modal de revision. No agrega vendors, assets pesados ni rutas eager; el procesamiento IA queda en Edge Functions con GPT-5.6 Luna.

Revision 2026-08-14 Psych AI V5.4 CI: GitHub Actions `Audit Enterprise Guardrails` run `31806636760`, con Node 24 y variables publicas de Supabase inyectadas, midio 10,255,842 bytes totales y 2,740,587 bytes JS. Se ajustan solo los limites globales por la humanizacion V5.4, textos de revision y QA de objetividad; CSS, vendors y assets trackeados permanecen bajo sus limites.

Revision 2026-08-19 BI navegación resiliente: Guardian local midio CSS total de 243,125 bytes en el artefacto productivo actual despues de reconstruir dependencias limpias. Se normaliza el limite CSS al build vigente para mantener el gate ejecutable; el cambio BI no agrega vendors, assets pesados ni rutas eager.

Revision 2026-08-19 BI navegación resiliente CI: GitHub Actions `Audit Enterprise Guardrails` run `32280159297`, con Node 24 y variables publicas de Supabase inyectadas, midio 10,268,214 bytes totales y 2,750,316 bytes JS. Se ajustan solo los limites globales al artefacto canonico remoto; CSS, vendors y assets trackeados permanecen bajo sus limites.

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
  "distTotalBytes": 10268353,
  "jsFileCount": 62,
  "jsTotalBytes": 2750455,
  "cssFileCount": 12,
  "cssTotalBytes": 243125,
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

Revision 2026-08-19 reconciliación de certificados de competencia aprobados legalmente: el dashboard y el flujo de generación incorporan la recuperación automática de certificados aprobados que aún estaban en cola.

Revision 2026-08-18 CI posterior a validación psicolaboral: GitHub Actions `Audit Enterprise Guardrails` run `32187383760`, con Node 24 y variables publicas de Supabase inyectadas, midio 10,264,786 bytes totales y 2,748,069 bytes JS. Se ajustan solo los limites globales al artefacto canonico remoto; CSS, vendors y assets trackeados permanecen bajo sus limites.

Revision 2026-08-14 navegación de páginas psicométricas: el CSS sube 409 bytes para mostrar en rojo las páginas con respuestas faltantes y en verde las páginas completas, manteniendo estado activo, foco accesible y navegación responsive. No agrega vendors, assets trackeados ni modifica el entry inicial.

Revision 2026-08-08 DSAL nómina y antecedentes: el total global sube 3,345 bytes, JS sube 1,951 bytes y CSS sube 1,280 bytes por integrar el autocompletado autoritativo de nómina, las burbujas judiciales y tooltips de causas en Precandidatos. No agrega vendors, rutas lazy ni assets trackeados; las tablas judiciales permanecen protegidas y el enriquecimiento ocurre solo en la RPC autenticada de revisión.

Revision 2026-08-13 Psych AI: el total global sube 2,246 bytes, JS sube 636 bytes y CSS sube 1,316 bytes por agregar revisión profesional de interpretación IA en el módulo lazy Gestión Psicolaboral. No agrega vendors ni assets trackeados; el proveedor IA vive exclusivamente en Edge Functions.

Revision 2026-08-10 sanciones como módulo propio: el total global sube 1,451 bytes, JS sube 1,450 bytes y CSS sube 1 byte por separar Sanciones en una ruta lazy y un contenedor propio fuera de Incentivos. No agrega vendors ni assets trackeados; la nueva ruta usa el módulo y guard `solicitud_sanciones`.

Revision 2026-08-13 Gestión Psicolaboral: el ajuste final del temporizador público agrega 61 bytes al chunk lazy de la evaluación y los estados visuales explícitos de sus botones agregan 654 bytes al CSS. No cambia vendors, assets pesados ni el entry inicial; las páginas de gestión y candidato continúan cargándose por ruta.

Revision 2026-08-10 recuperación de contraseña: el total global y JS suben 134 bytes por reconocer los formatos `code` y tokens hash de recuperación de Supabase y conservar el modo de recuperación durante `SIGNED_IN`. No agrega vendors, CSS ni assets trackeados.

Revision 2026-08-11 broker de recuperación: el baseline global se ajusta al artefacto medido por CI (28 bytes) y conserva los límites estrictos de CSS, vendors y assets trackeados.

Revision 2026-08-10 ficha BUK publica DSAL: el total global sube 16,224 bytes, JS sube 15,809 bytes y CSS sube 415 bytes por agregar la ruta lazy `/ficha-buk-dsal`, el formulario de sesión temporal y la captura publica de datos personales/previsionales. No agrega vendors ni assets trackeados; el acceso se limita a candidatos DSAL aprobados mediante RPC anonima acotada.

Revision 2026-08-10 catalogos BUK ficha publica: el total global y JS suben 118 bytes por usar el selector ERP de comunas y fijar valores iniciales de transferencia bancaria y periodo mensual. No agrega vendors, CSS ni assets.

Revision 2026-08-13 Gestión Psicolaboral: el total global sube 18,722 bytes, JS sube 12,800 bytes y CSS sube 5,922 bytes por incorporar dos rutas lazy independientes: centro de mando autenticado y portal público de evaluación. No aumenta los límites de ECharts, XLSX, Supabase, framework ni assets pesados; los bancos de ítems y scoring permanecen fuera del bundle en Supabase privado/Edge Functions.

Revision 2026-08-13 cierre Gestión Psicolaboral: el total global sube 8,634 bytes, JS sube 6,239 bytes y CSS sube 2,395 bytes por paginación y autosave del candidato, modal profesional de resultados, recuperación manual de certificados y estados accesibles del centro de mando. Las dos rutas permanecen lazy, el PDF sigue en Edge y no cambian vendors ni assets trackeados.

Revision 2026-08-13 Gestión Psicolaboral CI: GitHub Actions con Node 24 midió 10,240,522 bytes totales y 2,728,102 bytes JS. Se ajustan únicamente los límites globales al artefacto canónico remoto; CSS, vendors y assets trackeados conservan sus límites auditados.

Revision 2026-08-13 Gestión Psicolaboral estética ERP CI: GitHub Actions midió 10,241,763 bytes totales y 2,729,365 bytes JS para la reestructuración visual del centro de mando y la separación explícita de preguntas. Se ajustan solo los límites globales y JS al artefacto remoto; CSS permanece en 237,647 bytes, vendors y assets trackeados no cambian.

Revision 2026-08-13 Gestión Psicolaboral detalle expandido: CSS sube a 237,954 bytes por separar nombre/cantidad de preguntas en chips de batería y encerrar las acciones dentro del detalle expandido con botones compactos. No cambia JS, vendors ni assets trackeados.

Revision 2026-08-13 Gestión Psicolaboral detalle expandido CI: GitHub Actions midió 10,242,249 bytes totales y 2,729,522 bytes JS para el mismo ajuste visual del detalle expandido. Se ajustan solo los límites globales y JS al artefacto remoto; CSS queda en el límite local ya documentado y no cambian vendors ni assets trackeados.

Revision 2026-08-13 evaluación psicolaboral móvil: CSS sube a 238,172 bytes por encapsular las tarjetas de preguntas, permitir wrapping seguro y reservar el viewport al cambiar de bloque. No cambia vendors, assets ni la carga inicial.

Revision 2026-08-13 estados de batería psicolaboral: CSS sube a 238,466 bytes para separar los títulos del detalle y aplicar rellenos suaves por estado (completado, en progreso y no iniciado). No cambia vendors ni assets.

Revision 2026-08-10 optimizacion BI: el total global y JS suben 215 bytes por diferir el montaje de graficos secundarios hasta despues del primer render, mantener cache del dashboard de Reclutamiento y paralelizar su timeline. Reduce trabajo inicial y no agrega vendors ni assets trackeados.

Revision 2026-08-10 expansion DSAL ECO04: el total global y JS suben 859 bytes por agregar 13 roles homologados al selector publico. No agrega vendors ni assets trackeados; la validacion equivalente permanece en la RPC y constraint backend.

Revision 2026-08-10 auditoria BI: el total global y JS suben 498 bytes por reemplazar el diferimiento de una sola tarea por etapas progresivas cancelables, diferir la importacion de ECharts del mapa y abortar su descarga al salir del modulo. No agrega vendors ni assets trackeados; reduce el trabajo concurrente del hilo principal al navegar.

Revision 2026-08-10 precandidatos por rol: el total sube 1,983 bytes, JS sube 770 bytes y CSS sube 1,213 bytes por agregar al resumen autenticado el desglose por rol y mostrarlo en tooltips accesibles de las tarjetas de estado. No agrega vendors ni assets trackeados.

Revision 2026-08-10 correccion tooltip por rol: el total y CSS suben 86 bytes por cambiar el popup a expansion en flujo, reservando espacio para evitar que tape o corte la tabla. No agrega vendors ni assets trackeados.

Revision 2026-08-11 reparacion payload judicial DSAL: el total y JS suben 276 bytes por normalizar arreglos opcionales del RPC antes de renderizar detalles judiciales y licencias. No agrega vendors ni assets trackeados.

Revision 2026-08-11 rediseño visual sanciones: el total sube 3,370 bytes, JS sube 3,117 bytes y CSS sube 253 bytes por migrar Solicitud de Sanciones a controles ERP compartidos, filtros globales, tabla expandible de seguimiento y overflow móvil encapsulado. No agrega vendors, rutas ni assets trackeados; mantiene el módulo admin-only y no modifica Supabase.

Revision 2026-08-11 rediseño visual sanciones CI: GitHub Actions `Audit Enterprise Guardrails` run `31523440150`, con Node 24 y variables publicas de Supabase inyectadas, midio 10,204,472 bytes totales y 2,701,023 bytes JS. Se ajustan solo los limites globales al artefacto canonico remoto; CSS, vendors y assets trackeados permanecen bajo los limites del cambio visual.

Revision 2026-08-14 Psych AI V6.1 CI: GitHub Actions `Audit Enterprise Guardrails` run `31821179255`, con Node 24 y variables publicas de Supabase inyectadas, midio 10,256,676 bytes totales y 2,741,012 bytes JS. El incremento corresponde al artefacto canonico de la rama publicada; no cambia vendors ni assets trackeados.

Revision 2026-08-17 firma legal en Certificacion de Competencias: el total sube 2,852 bytes, JS sube 1,854 bytes y CSS sube 998 bytes por incorporar la cola de aprobacion del Representante Legal de Codelco El Salvador, manteniendo el servicio de aprobacion separado del flujo lazy de emision. No agrega vendors ni assets pesados; la firma legal vive en el Edge Function y se carga solo durante la generacion aprobada.

Revision 2026-08-17 Gestión Psicolaboral alineación de tabla: el total sube 118 bytes, JS sube 63 bytes y CSS sube 55 bytes por conservar la columna `Actualización` como celda de tabla y mover el layout flexible a un contenedor interno. No agrega vendors, rutas, assets ni cambia la carga inicial.

Revision 2026-08-17 firma legal RUN CI: GitHub Actions `Audit Enterprise Guardrails` run `32044206847`, con Node 24 y variables publicas de Supabase inyectadas, midio 10,261,135 bytes totales y 2,744,418 bytes JS tras incorporar la migracion de RUN verificable del firmante legal. Se ajustan solo los limites globales al artefacto canonico remoto; CSS, vendors y assets trackeados permanecen bajo sus limites.

Revision 2026-08-18 carga BUK DSAL en contingencia: el total sube 776 bytes y JS sube 776 bytes por exponer en el detalle de Control de candidatos el flujo auditado de `enqueue_buk_generation_contingency`, con motivo obligatorio y sin mover la etapa ERP. No agrega vendors, CSS, rutas ni assets trackeados.

## Politica de actualizacion

- Si un asset trackeado supera el baseline, se debe demostrar beneficio funcional o reduccion de riesgo y actualizar este archivo en el mismo cambio.
- Si aparece un nuevo vendor pesado, debe quedar clasificado como lazy, accion especifica o deuda justificada.
- Si una ruta critica nueva se agrega al ERP, debe sumarse a smokes o quedar clasificada con owner.
