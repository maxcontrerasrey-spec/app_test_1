# ATLAS Performance — Fase 1B: Jornadas

Fecha: 2026-10-07. Base de release: `bbae9dacf7bfabe4efc44d3ef32b6438a28ecb93`. Release: PR #68 integrado en `main` como `34f4f51df782dd2f09210911b77e89ca7cc60642`. Alcance: calendario general de Jornadas, filtros/facetas, paginación y Excel. Migración SQL aplicada antes del frontend como `20261007153510`.

## 1. Resumen ejecutivo

Se implementó localmente una lectura paginada por trabajador con cursor compuesto y un resumen/facetas que no genera el producto trabajador×día. La página limita la expansión a 50 trabajadores antes de `generate_series`, rango máximo 184 días (máximo teórico 9.200 celdas por respuesta). La exportación explícita consume el mismo RPC en lotes. Se conservan las funciones legacy para rollback.

El backend y el frontend quedaron publicados de forma controlada: la migración compiló y se ejecutó en PostgreSQL productivo, el smoke acotado devolvió el contrato esperado y la autorización negativa bloqueó una llamada sin identidad. Cloudflare Pages sirve el build auditado en `gestion.busesjm.cl`; el JS principal, el chunk de Jornadas y el CSS tienen el mismo SHA-256 remoto y local. No se ejecutaron carga, estrés, `EXPLAIN ANALYZE` ni una equivalencia exhaustiva sin staging; por eso `AFTER = NOT MEASURED` y la mejora de latencia no se declara resuelta todavía.

## 2. Hallazgos resueltos en código local

- La respuesta inicial del calendario ya no requiere el calendario completo; debe haber un contrato/área/administrador seleccionado, y el lote está limitado a 50 personas antes de expandir días.
- Los totales/facetas se calculan por RPC separado desde asignaciones efectivas e intervalos, sin construir días JSON.
- Se conserva búsqueda, filtro operacional y de administrador, filtro de ciclo base (p. ej. `4X4`) y `Sin Jornada`; orden estable con clave BUK de desempate.
- Se preservan los límites actuales del backend (horizonte y máximo de 184 días), permisos `user_can_view_hr_roster`, excepciones, fin de asignación/invalidez BUK, fecha de salida y forma diaria del JSON.
- React Query incluye los filtros/cursor en las claves, propaga `AbortSignal` y espera 250 ms para la búsqueda antes de consultar.
- Excel descarga todas las páginas bajo el filtro activo solo al pedir exportación; evita reutilizar la respuesta masiva durante la carga inicial.
- Se corrigió el extractor SQL del nombre de ciclo para capturar el ciclo completo (`4X4`, `10X5+5`) y el identificador del filtro `Sin Jornada` en Excel.

## 3. Validación pendiente / parcial

- La SQL se ejecutó en PostgreSQL productivo mediante migración forward-only. El smoke usó una cuenta superadmin, un contrato real, un día y una página de una persona; no sustituye equivalencia exhaustiva ni medición de performance.
- No hay staging para comparación automatizada con RPC legacy, pruebas sintéticas de múltiples fichas/excepciones/salida, `EXPLAIN (ANALYZE, BUFFERS)` ni load test. Los advisors productivos se revisaron sin ejecutar carga: no detectaron hallazgos de performance nuevos y registran como intencionales las dos RPC `SECURITY DEFINER` autenticadas y protegidas internamente.
- El cursor evita `OFFSET`, pero una exportación que abarque varias llamadas no comparte snapshot de base de datos; mutaciones concurrentes pueden cambiar resultados entre páginas. Se registra como limitación de consistencia por decidir/validar.
- El mapeo legacy de `effective_status` al marcar `termination` como `medical_leave` se conserva exactamente para no cambiar semántica; requiere comparación funcional existente y posible issue separado.
- Guardian local completado: 0 errores / 0 warnings, incluidos `git diff --check`; las pruebas PostgreSQL staging siguen pendientes. El build local y el gate de baseline pasan.
- Build TypeScript/producción y auditor de bundle: `dist` 7.418.066 B, JS 5.304.179 B y CSS 534.713 B; los límites machine-readable no se ampliaron. El total medido no es una comparación causal con el bundle productivo.
- Tests unitarios: 160 en 34 archivos; tests focalizados Jornadas/contrato: 17 en 3 archivos. Auditoría de nombres/historial: 613 migraciones canónicas, sin duplicados. Auditoría estática Supabase: 88 avisos históricos; la salida no listó la migración nueva como origen de un aviso. Guardian final: 0 errores / 0 warnings.
- Release: CI Enterprise verde; commit de merge `34f4f51d`. Cloudflare deployment `a574bafe-bc64-4b45-9171-7e63a399777c`; `index-xz0Yf4Yp.js`, `RosterPage-DbekQk1s.js` e `index-DczyPlkl.css` coinciden byte a byte con el build local. La sesión de navegador disponible redirigió a `/login`, por lo que no se introdujeron credenciales ni se simuló una sesión.

## 4. Pendientes fuera de esta fase

Se preservan los demás hallazgos del tracker; no se optimizan ni declaran resueltos: home/dashboard, inicio de sesión, Reclutamiento, Sync BUK, Psicolaboral, Incentivos, Estructuras de Renta, Comunicaciones/R2, Sanciones, Acreditación, Competencias, BI, Alta Operacional, deuda de índices/FK/RLS y concurrencia de escala masiva.

## 5. Jornadas — antes/después

| Operación | Antes | Después | Evidencia | Estado |
|---|---|---|---|---|
| Resumen por mes | Promedio 1.210 ms, máximo 7.730 ms, `n=2.408` (telemetría histórica agregada; no percentiles) | No cambia el resumen mensual global; `AFTER = NOT MEASURED` | Se mantiene el endpoint mensual para `Todos`; resumen de rango/alcance nuevo para calendario general | Parcial |
| Calendario bulk/PostgREST | Variantes históricas ~1.179–2.101 ms; medición directa diagnóstica ~26,7 s promedio, máximo 54,6 s. Muestras/rutas distintas; no son una comparación controlada | Máximo 50 × D celdas por página (350 / 1.550 / 4.500 / 9.200 para 7 / 31 / 90 / 184 días); latencia y bytes `NOT MEASURED` | SQL productivo limita antes de `generate_series`; smoke acotado aprobado; carga sigue bloqueada sin staging | Implementado, medición pendiente |
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

Migración aplicada y reconciliada: `supabase/migrations/20261007153510_roster_calendar_pagination_v2.sql`, posterior al head productivo previo `20261007145851`. Añade dos entrypoints `authenticated` y un helper privado, mantiene las firmas legacy y no cambia RLS, roles ni matrices de acceso. Verificación: owner `postgres`; wrappers `SECURITY DEFINER` con `search_path=public, pg_temp`, sin EXECUTE para `anon`; helper `SECURITY INVOKER` sin EXECUTE para roles API; prueba negativa sin identidad bloqueada. Rollback funcional: revertir el frontend a las RPC legacy mediante un cambio forward-only; no borrar historial de migraciones.

ADR: [ADR-ROSTER-CALENDAR-PAGINATION.md](ADR-ROSTER-CALENDAR-PAGINATION.md). Tracker vivo: [PERFORMANCE_REMEDIATION_TRACKER.md](PERFORMANCE_REMEDIATION_TRACKER.md).
