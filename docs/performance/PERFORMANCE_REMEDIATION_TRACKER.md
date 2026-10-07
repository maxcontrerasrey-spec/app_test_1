# ATLAS ERP — Tracker único de remediación de performance

Actualizado: 2026-10-07. Los datos de auditoría conservan su ventana y método originales; no se reinterpretan como percentiles si no fueron medidos como tales.

Estados permitidos: `PENDING`, `IN_ANALYSIS`, `IMPLEMENTED_UNVALIDATED`, `VALIDATING`, `RESOLVED`, `ACCEPTED_RISK`, `NO_CHANGE_REQUIRED`, `BLOCKED_VALIDATION`, `REGRESSION`, `ROLLED_BACK`.

## Contexto de ejecución

- Release productivo: PR #68 integrado en `main` como `34f4f51df782dd2f09210911b77e89ca7cc60642`; árbol de salida idéntico al auditado y CI Enterprise verde.
- Supabase producción: `pzblmbahnoyntrhistea`. El inventario previo encontró cero branches; no hay PostgreSQL local (Docker/psql). El usuario rechazó crear una rama Preview facturable y pidió esperar staging existente.
- Alcance seguro actualizado por instrucción expresa del usuario: release productivo controlado, SQL aditivo antes del frontend, sin carga, estrés ni pruebas destructivas contra producción.
- `BLOCKED_VALIDATION` identifica gates externos no ejecutables; no impide análisis, implementación o validación local de ese mismo módulo.

## Resumen de hallazgos

| ID | Módulo / severidad | Estado | Evidencia original / siguiente trabajo |
|---|---|---|---|
| P0-RELEASE | SHA ↔ esquema y release gate | `RESOLVED` | PR #68 integrado como `34f4f51d`; migración `20261007153510`, smoke autenticado y autorización negativa aprobados. Cloudflare producción sirve el bundle exacto auditado. La sesión de navegador disponible estaba en `/login`, por lo que no se simuló una sesión ni se usaron credenciales. |
| P0-OBS | Telemetría UI/RPC/render, percentiles, bytes, throughput | `BLOCKED_VALIDATION` | Instrumentación local disponible; muestreo integrado por ruta/acción exige staging. |
| P1-ATLAS | Atlas `atlas_ops_search_drivers` | `BLOCKED_VALIDATION` | Implementación local P1; equivalencia, permisos, plan y carga aún requieren PostgreSQL/staging. |
| P1-MOB | Movilidad `search_internal_mobility_workers` + catálogos | `BLOCKED_VALIDATION` | Cambios locales de búsqueda/cancelación; validar multiplicidad, acentos, RUT, permisos, plan y latencia en staging. |
| P1-PROJECTION | Proyección común del padrón | `NO_CHANGE_REQUIRED` | No crearla por intuición; reconsiderar solo con evidencia de consumidores, costo de escritura y costo de Sync BUK. |
| P1-ROSTER | Jornadas calendario general | `IMPLEMENTED_UNVALIDATED` | RPC v2, cursor y límite de 50 implementados; SQL productivo y ACL verificados. Equivalencia exhaustiva, planes y carga siguen `BLOCKED_VALIDATION` sin staging. |
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
- Pruebas: Guardian local y CI Enterprise 0 errores/0 warnings; pruebas unit/contract, TypeScript/build, auditoría de migraciones/seguridad, baseline y `git diff --check` pasan. Migración productiva `20261007153510`; smoke acotado de resumen/página y guard negativo aprobados. Límite máximo: 50 × 184 = 9.200 celdas por respuesta.
- Before/after y p50/p95/p99: before solo diagnósticos anteriores no equivalentes; after `NOT MEASURED`; percentiles `NO MEDIDO`.
- EXPLAIN/BUFFERS/equivalencia/carga: `BLOCKED_VALIDATION` sin PostgreSQL staging. Advisors productivos revisados después de DDL, sin hallazgos de performance asociados; los avisos `SECURITY DEFINER` para las dos RPC son intencionales y están mitigados por guard interno, `search_path` fijo y ACL autenticada.
- Residual: validar personas con varias pautas, excepciones, salidas, `Sin Jornada`, filtros, facetas y consistencia temporal de exportación. Rollback: restaurar cliente/RPC legacy mediante migración forward-only compensatoria; no revertir migraciones aplicadas.
- SHA: base `bbae9dacf7bfabe4efc44d3ef32b6438a28ecb93`; commits de implementación `6a043e7c`, `f3adb6b9` y `a0ad0030`; PR #68 integrado como `34f4f51d` tras restablecerse `receive-pack`.

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
6. Reabrir todos los `BLOCKED_VALIDATION` para cerrar afirmaciones de rendimiento y escala. El release funcional ya fue autorizado y ejecutado de forma controlada; estos gates no deben correrse contra producción.

## Historia

- 2026-10-07: Fase 1B Jornadas quedó implementada, validada localmente y compilada en PostgreSQL productivo mediante migración `20261007153510`; performance posterior aún no medida.
- 2026-10-07: PR #68 integrado como `34f4f51d`; Cloudflare producción publica el build auditado. Los hashes productivos de `index-xz0Yf4Yp.js`, `RosterPage-DbekQk1s.js` e `index-DczyPlkl.css` coinciden con `dist`.
- 2026-10-07: reanudado loop maestro. Se mantiene la negativa del usuario a crear una rama temporal de costo; staging sigue externo. Sin escrituras ni carga a producción.
