# Carga protegida de Jornadas

El harness `worker-search.js` contiene también las llamadas Atlas/Movilidad de Fase 0/P1. Solo se ejecuta contra Supabase staging. A la fecha de la Fase 1B no existe staging conectado a este proyecto y el harness **no se ejecutó**.

## Datos y escenarios

- Crear cuentas y trabajadores sintéticos directamente en staging; no copiar ni seudonimizar filas productivas. No incluir nombres, RUT, IDs BUK ni tokens reales en fuentes, logs o resultados compartidos.
- Preparar escalas `1x`, `10x`, `50x` respecto del padrón agregado que se use como referencia. Mantener distribuciones aproximadas de áreas/contratos, cargos, ciclos, asignaciones solapadas, excepciones, salidas, inactivos y múltiples fichas. Registrar por separado cuántos registros sintéticos se crearon y cómo se limpiarán únicamente en staging.
- Usar `PERFORMANCE_SYNTHETIC_ROSTER_AREA` y `PERFORMANCE_SYNTHETIC_SEARCH_TERM` correspondientes exclusivamente al dataset sintético de staging.
- Medir combinaciones de 7, 31, 90 y 184 días y contratos/áreas de densidad pequeña, media y grande. El SLO inicial acordado por el plan es una entrada al calendario con contrato/área definido, 50 trabajadores y 31 días: p95 de `roster_calendar_duration` < 2.000 ms, error rate < 0,5%.
- Registrar p50/p95/p99, throughput, bytes recibidos y errores de k6; correlacionar con CPU, memoria, conexiones, I/O, shared buffers, spills y `EXPLAIN (ANALYZE, BUFFERS)` en staging. k6 no mide estos indicadores de base por sí mismo.

## Progresión manual

Establecer `PERFORMANCE_VUS` y `PERFORMANCE_CONFIRMED_VUS` a un único tier de `10`, `50`, `100`, `250` o `500`, confirmar `PERFORMANCE_DATASET_SCALE` con `PERFORMANCE_CONFIRMED_DATASET_SCALE`, y establecer `PERFORMANCE_SYNTHETIC_DATASET_READY=true`. Cada ejecución dura 1 minuto y corre un solo tier. Inspeccionar errores, latencias, conexiones y saturación después de cada corrida antes de aumentar el tier. El script no escala automáticamente al siguiente nivel.

Variables requeridas: `PERFORMANCE_TARGET_ENV=staging`, ref/URL staging, anon key y JWT autenticado de staging, términos sintéticos de nombre/documento, área operacional sintética, fechas ISO del rango y escala/dataset confirmados. Solo cargar credenciales por variables de entorno en el runner; no añadirlas a archivos ni argumentos versionados.

## Protección

El script aborta salvo `PERFORMANCE_TARGET_ENV=staging`, URL HTTPS exacta `${ref}.supabase.co`, ref distinta a producción, dataset sintético expresamente confirmado y tier permitido confirmado dos veces. Nunca apuntar producción, incluso para una prueba breve.
