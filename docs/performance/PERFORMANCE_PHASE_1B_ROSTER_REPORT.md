# ATLAS Performance — Fase 1B: Jornadas

Fecha: 2026-10-07. Base de implementación: `5b7f7217d22658e19ef2ab1b91a824c3af6672d3` (`origin/main` verificado). Alcance: calendario general de Jornadas, filtros/facetas, paginación y Excel. No se desplegó código ni se aplicó SQL.

## 1. Resumen ejecutivo

Se implementó localmente una lectura paginada por trabajador con cursor compuesto y un resumen/facetas que no genera el producto trabajador×día. La página limita la expansión a 50 trabajadores antes de `generate_series`, rango máximo 184 días (máximo teórico 9.200 celdas por respuesta). La exportación explícita consume el mismo RPC en lotes. Se conservan las funciones legacy para rollback.

No está listo para liberar: no existe una rama/instancia Supabase staging disponible en el proyecto inspeccionado; no se pudo compilar/ejecutar la migración en PostgreSQL ni comparar resultados/planes ni medir carga. `AFTER = NOT MEASURED`. Producción no fue modificada.

## 2. Hallazgos resueltos en código local

- La respuesta inicial del calendario ya no requiere el calendario completo; debe haber un contrato/área/administrador seleccionado, y el lote está limitado a 50 personas antes de expandir días.
- Los totales/facetas se calculan por RPC separado desde asignaciones efectivas e intervalos, sin construir días JSON.
- Se conserva búsqueda, filtro operacional y de administrador, filtro de ciclo base (p. ej. `4X4`) y `Sin Jornada`; orden estable con clave BUK de desempate.
- Se preservan los límites actuales del backend (horizonte y máximo de 184 días), permisos `user_can_view_hr_roster`, excepciones, fin de asignación/invalidez BUK, fecha de salida y forma diaria del JSON.
- React Query incluye los filtros/cursor en las claves, propaga `AbortSignal` y espera 250 ms para la búsqueda antes de consultar.
- Excel descarga todas las páginas bajo el filtro activo solo al pedir exportación; evita reutilizar la respuesta masiva durante la carga inicial.
- Se corrigió el extractor SQL del nombre de ciclo para capturar el ciclo completo (`4X4`, `10X5+5`) y el identificador del filtro `Sin Jornada` en Excel.

## 3. Validación pendiente / parcial

- La nueva SQL no se ejecutó en PostgreSQL; los tests de contrato revisan límites, orden, composición de permisos, intervalos y cancelación, pero no sustituyen una prueba DB.
- No hay staging para comparación con RPC legacy, pruebas de múltiples fichas/excepciones/salida, `EXPLAIN (ANALYZE, BUFFERS)`, asesores Supabase ni load test.
- El cursor evita `OFFSET`, pero una exportación que abarque varias llamadas no comparte snapshot de base de datos; mutaciones concurrentes pueden cambiar resultados entre páginas. Se registra como limitación de consistencia por decidir/validar.
- El mapeo legacy de `effective_status` al marcar `termination` como `medical_leave` se conserva exactamente para no cambiar semántica; requiere comparación funcional existente y posible issue separado.
- Guardian local completado: 0 errores / 0 warnings, incluidos `git diff --check`; las pruebas PostgreSQL staging siguen pendientes. El build local y el gate de baseline pasan.
- Build TypeScript/producción y auditor de bundle: `dist` 7.418.066 B, JS 5.304.179 B y CSS 534.713 B; los límites machine-readable no se ampliaron. El total medido no es una comparación causal con el bundle productivo.
- Tests unitarios: 160 en 34 archivos; tests focalizados Jornadas/contrato: 17 en 3 archivos. Auditoría de nombres/historial: 613 migraciones canónicas, sin duplicados. Auditoría estática Supabase: 88 avisos históricos; la salida no listó la migración nueva como origen de un aviso. Guardian final: 0 errores / 0 warnings.

## 4. Pendientes fuera de esta fase

Se preservan los demás hallazgos del tracker; no se optimizan ni declaran resueltos: home/dashboard, inicio de sesión, Reclutamiento, Sync BUK, Psicolaboral, Incentivos, Estructuras de Renta, Comunicaciones/R2, Sanciones, Acreditación, Competencias, BI, Alta Operacional, deuda de índices/FK/RLS y concurrencia de escala masiva.

## 5. Jornadas — antes/después

| Operación | Antes | Después | Evidencia | Estado |
|---|---|---|---|---|
| Resumen por mes | Promedio 1.210 ms, máximo 7.730 ms, `n=2.408` (telemetría histórica agregada; no percentiles) | No cambia el resumen mensual global; `AFTER = NOT MEASURED` | Se mantiene el endpoint mensual para `Todos`; resumen de rango/alcance nuevo para calendario general | Parcial |
| Calendario bulk/PostgREST | Variantes históricas ~1.179–2.101 ms; medición directa diagnóstica ~26,7 s promedio, máximo 54,6 s. Muestras/rutas distintas; no son una comparación controlada | Máximo 50 × D celdas por página (350 / 1.550 / 4.500 / 9.200 para 7 / 31 / 90 / 184 días); latencia y bytes `NOT MEASURED` | SQL local limita antes de `generate_series`; sin Postgres staging | Implementado localmente, no validado |
| Ciclos/conteos | Se derivaban de todos los días transferidos al cliente | Facetas globales derivadas de segmentos de intervalos; sin grilla por persona/día | Contrato estático; equivalencia exacta pendiente | Parcial |
| Excel | Reutilizaba la carga masiva completa | Acción explícita, cursor por lote de 50 y filtros aplicados | Implementación local; memoria/tiempo y snapshot concurrente no medidos | Parcial |

Los diagnósticos de 26,7 s/54,6 s no se deben comparar como p95 ni atribuirse al endpoint público sin la consulta, datos y condiciones equivalentes.

## 6. Atlas/Movilidad — cierre de validación

No pueden pasar a `RESUELTO`. Continúan `PARCIAL / EN VALIDACIÓN` por falta de staging, equivalencia ejecutable y planes/mediciones. La implementación previa de Fase 0/P1 permanece en su worktree aislado, sin alteración ni integración accidental.

## 7. Cambios de arquitectura

- Dos RPC versionadas v2 y un helper `private` set-based no accesible a roles API.
- Cursores de keyset con orden `(full_name, buk_employee_id)`; máximo de 50 filas diarias por llamada de calendario.
- El resumen y las facetas se separan del JSON de días; no se crea caché/proyección ni índices sin evidencia de plan.
- Harness k6 reutilizable (`performance/k6/worker-search.js`), protegido contra producción, con un tier de VUs por ejecución y gate manual entre niveles; el dataset sintético y las corridas quedan pendientes en [README](../../performance/k6/README.md).

## 8. Migración y rollback

Migración local: `supabase/migrations/20261007153000_roster_calendar_pagination_v2.sql`. Su versión es posterior al último head productivo conocido (`20261007145851`) para impedir que el frontend se libere antes que sus RPC. Añade dos entrypoints authenticated y un helper privado; mantiene las firmas legacy. Rollback funcional: revertir frontend a RPC existente. La migración no se aplicó y no se desplegó el frontend.

ADR: [ADR-ROSTER-CALENDAR-PAGINATION.md](ADR-ROSTER-CALENDAR-PAGINATION.md). Tracker vivo: [PERFORMANCE_REMEDIATION_TRACKER.md](PERFORMANCE_REMEDIATION_TRACKER.md).
