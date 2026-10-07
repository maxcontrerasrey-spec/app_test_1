# ATLAS ERP — Tracker único de remediación de performance

Actualizado: 2026-10-07. Los datos de auditoría conservan su ventana y método originales; no se reinterpretan como percentiles si no fueron medidos como tales.

Estados permitidos: `PENDING`, `IN_ANALYSIS`, `IMPLEMENTED_UNVALIDATED`, `VALIDATING`, `RESOLVED`, `ACCEPTED_RISK`, `NO_CHANGE_REQUIRED`, `BLOCKED_VALIDATION`, `REGRESSION`, `ROLLED_BACK`.

## Contexto de ejecución

- Base del worktree activo: `5b7f7217d22658e19ef2ab1b91a824c3af6672d3`; mantiene cambios locales Fase 1B sin commit.
- Supabase producción: `pzblmbahnoyntrhistea`. El inventario previo encontró cero branches; no hay PostgreSQL local (Docker/psql). El usuario rechazó crear una rama Preview facturable y pidió esperar staging existente.
- Alcance seguro: inspección y consultas históricas read-only; cambios, tests sintéticos, build y auditorías locales. No cargar ni desplegar a producción; no ejecutar carga/destructivos contra producción.
- `BLOCKED_VALIDATION` identifica gates externos no ejecutables; no impide análisis, implementación o validación local de ese mismo módulo.

## Resumen de hallazgos

| ID | Módulo / severidad | Estado | Evidencia original / siguiente trabajo |
|---|---|---|---|
| P0-RELEASE | SHA ↔ esquema y release gate | `BLOCKED_VALIDATION` | Fases 0/P1/1B locales; requiere staging con migraciones aplicadas, smoke autenticado y observación. No liberar mientras siga bloqueado. |
| P0-OBS | Telemetría UI/RPC/render, percentiles, bytes, throughput | `BLOCKED_VALIDATION` | Instrumentación local disponible; muestreo integrado por ruta/acción exige staging. |
| P1-ATLAS | Atlas `atlas_ops_search_drivers` | `BLOCKED_VALIDATION` | Implementación local P1; equivalencia, permisos, plan y carga aún requieren PostgreSQL/staging. |
| P1-MOB | Movilidad `search_internal_mobility_workers` + catálogos | `BLOCKED_VALIDATION` | Cambios locales de búsqueda/cancelación; validar multiplicidad, acentos, RUT, permisos, plan y latencia en staging. |
| P1-PROJECTION | Proyección común del padrón | `NO_CHANGE_REQUIRED` | No crearla por intuición; reconsiderar solo con evidencia de consumidores, costo de escritura y costo de Sync BUK. |
| P1-ROSTER | Jornadas calendario general | `BLOCKED_VALIDATION` | RPC v2, cursor y límite de 50 implementados localmente; equivalencia SQL, planes, advisors y load staging pendientes. |
| P1-BI | BI Dotación | `IN_ANALYSIS` | Baseline histórico del prompt: promedio ~1.324 ms, máximo ~7,69 s, ~34.157 shared blocks y ~85 temp blocks/call. Verificar código/telemetría y causa actual antes de optimizar. |
| P1-HOME | Inicio / Dashboard / `get_dashboard_home_bundle` | `PENDING` | Auditoría reportó 30.773 llamadas, promedio ~1.095 ms, máximo ~7,934 s y ~9.905 blocks/call. Separar criticidad, duplicación, bytes y render. |
| OBS-AUTH | Auth/permisos → primer render | `PENDING` | Medir cada tramo por separado sin atribuir espera de UI a SQL sin trazas. |
| P1-SYNC | Sync BUK | `PENDING` | Baseline histórico: job positions p95 ~53,6 s; finalize promedio ~43,1 s; snapshot ~17,2 s. Segmentar por run ID/etapa. |
| P2-REC | Reclutamiento | `PENDING` | Perfil BUK, checklist y detalle; perfilar flujos separados. |
| P2-COMP | Competencias | `PENDING` | Búsqueda y certificado; preservar folio, hash y PDF. |
| P2-SANC | Sanciones | `PENDING` | Reproducir consulta real antes de modificar filtros o backend. |
| P2-ACC | Acreditación | `PENDING` | Separar catálogos, búsqueda, ciclo documental y archivos R2. |
| P2-COMM | Comunicaciones/R2 | `PENDING` | Upload, hash, persistencia, compresión/progreso y tamaño de archivo. |
| P2-PSY | Psicolaboral | `PENDING` | Polling, concurrencia, certificados y 5xx por separado; sin datos personales en telemetría. |
| P2-RENT | Estructuras de Renta | `PENDING` | Reproducir clic → RPC → detalle → render; no inferir causalidad UI de timeouts históricos. |
| X-INDEX | Índices/FK/RLS/advisors | `PENDING` | Auditoría previa ~87 FK sin índice, ~114 índices aparentemente no usados, 7 advertencias RLS superpuestas; análisis consulta-por-consulta, sin cambios masivos. |
| P0-CAPACITY | Escala concurrente/capacidad | `BLOCKED_VALIDATION` | Harness k6 staging-only; faltan staging, dataset sintético ejecutado y métricas representativas. |

## Fichas de evidencia por módulo

Cada ficha registra: **fuente/baseline; causa raíz; cambio; pruebas; before/after; p50/p95/p99; EXPLAIN/BUFFERS; riesgo residual; rollback; SHA**. `NO MEDIDO` significa que no hay evidencia comparable; `BLOCKED_VALIDATION` se reserva para trabajo dependiente del entorno externo.

### P1-ROSTER — Jornadas

- Fuente/baseline: auditoría del prompt maestro y `PERFORMANCE_PHASE_1B_ROSTER_REPORT.md`; resumen anterior ~1.210 ms (n=2.408), bulk histórico ~1.179–2.101 ms; llamada diagnóstica diferente ~26,7 s promedio / 54,6 s máximo. No son comparaciones controladas.
- Causa/solución local: cardinalidad trabajador × día transferida antes de paginar; filtros de ciclo, conteos y exportación debían mantenerse equivalentes. RPCs v2 filtran trabajadores antes de `generate_series`, separan facetas y limitan página a 50; exportación pagina bajo demanda.
- Pruebas locales: Guardian 0 errores/0 warnings; pruebas unit/contract, TypeScript/build, auditoría de migraciones/seguridad, baseline y `git diff --check` pasan según el reporte local. Límite máximo: 50 × 184 = 9.200 celdas por respuesta.
- Before/after y p50/p95/p99: before solo diagnósticos anteriores no equivalentes; after `NOT MEASURED`; percentiles `NO MEDIDO`.
- EXPLAIN/BUFFERS/equivalencia/advisors: `BLOCKED_VALIDATION` sin PostgreSQL staging.
- Residual: validar personas con varias pautas, excepciones, salidas, `Sin Jornada`, filtros, facetas y consistencia temporal de exportación. Rollback: restaurar cliente/RPC legacy mediante migración forward-only compensatoria; no revertir migraciones aplicadas.
- SHA: base `5b7f7217d22658e19ef2ab1b91a824c3af6672d3`; trabajo local sin commit.

### P1-BI — Dotación — auditoría en curso

- Fuente/baseline: cifras históricas del prompt maestro; no reconsultadas todavía en esta reanudación. Código vivo: `BiDashboardPage`, `useBiQueries`, `biApi`, RPC `get_bi_dotacion_dashboard` y migraciones de single-scan/optimización.
- Causa raíz: pendiente de reconstruir desde el SQL efectivo y el camino de filtros/series; no inferir que el scan único anterior cerró el máximo de 7,69 s.
- Cambio/pruebas: ninguno en esta reanudación hasta probar causa. Validar filtro cruzado, cancelación, cache, transiciones de gráficos y que KPIs respondan al mismo universo.
- Before/after, p50/p95/p99, EXPLAIN/BUFFERS: histórico sólo; after/percentiles y plan nuevos `NO MEDIDO` / `BLOCKED_VALIDATION`.
- Residual/rollback/SHA: preservar permisos BI y filtros ejecutivos, no tocar RLS; migraciones forward-only y rollback diseñado antes de cualquier SQL. SHA de base: el del contexto de ejecución.

### Módulos aún no auditados

- `P1-HOME`, `P1-SYNC`, `P2-REC`, `P2-COMP`, `P2-SANC`, `P2-ACC`, `P2-COMM`, `P2-PSY`, `P2-RENT`, `X-INDEX`, `P0-OBS` y `P0-CAPACITY`: baseline, causa raíz, cambio, pruebas y rollback se completarán al ejecutar su análisis. Hasta entonces siguen en el estado de la tabla; no se atribuyen mejoras ni mediciones inexistentes.

## Gates exclusivamente externos (no ejecutar en producción)

1. Preparar staging sin datos reales, aplicar migraciones locales y registrar SHA↔versión de esquema.
2. Ejecutar equivalencia de RPC anterior/nueva con fixtures sintéticos, permisos/roles negativos y casos de borde.
3. Capturar `EXPLAIN (ANALYZE, BUFFERS)` y advisors donde aplique; comparar bloques/temp spill y resultado.
4. Ejecutar harness k6 por tiers sintéticos autorizados; registrar p50/p95/p99, error rate, bytes, CPU/IO/conexiones y validar gates antes del siguiente tier.
5. Revisar consistencia temporal de exportación de Jornadas y hacer smoke autenticado por rol.
6. Reabrir todos los `BLOCKED_VALIDATION`; solo después de los gates se puede proponer un release (este loop no despliega producción).

## Historia

- 2026-10-07: Fase 1B Jornadas quedó implementada y validada localmente, no medida contra PostgreSQL.
- 2026-10-07: reanudado loop maestro. Se mantiene la negativa del usuario a crear una rama temporal de costo; staging sigue externo. Sin escrituras ni carga a producción.
