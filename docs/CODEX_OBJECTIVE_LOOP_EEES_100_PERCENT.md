# CODEX OBJECTIVE LOOP --- EEES 100% ENTERPRISE CLOSURE

## OBJETIVO ÚNICO

Lleva este ERP desde su estado EEES actual hasta **EEES ENTERPRISE: 100%
IMPLEMENTED & CERTIFIED**.

No trabajes por prompts ni aprobaciones intermedias. Ejecuta
autónomamente este loop hasta cierre:

`INSPECT → MEASURE → FIND GAP → PRIORITIZE → IMPLEMENT → TEST → GUARD → VERIFY → DOCUMENT → RE-INSPECT → REPEAT`

No termines mientras exista una brecha técnicamente ejecutable dentro
del repositorio.

## BOOT

Antes de modificar: 1. Lee `AGENTS.md`. 2. Lee completo
`eees/codex/BOOT_SEQUENCE.md`. 3. Lee `tasks/todo.md` y
`tasks/lessons.md`. 4. Lee todos los Books, baselines, auditorías,
certificaciones, playbooks y closure reports EEES vigentes. 5. Contrasta
documentación contra el código real.

El código es evidencia, no automáticamente el estándar. Corrige la
fuente equivocada cuando código y documentación discrepen.

## AUTONOMÍA

No pidas autorización para avanzar entre P5, P6 o fases posteriores.
Continúa hasta el Definition of Done.

Solo detente ante BLOCKER EXTERNO REAL: - secret/credencial
inaccesible; - acción destructiva sobre producción; - decisión
contractual/legal/de negocio no inferible; - dependencia externa
inaccesible necesaria para validar; - cambio irreversible que requiera
autorización humana.

Aísla el blocker y continúa con todo lo demás.

## NO SIMULACIÓN

PASS requiere evidencia ejecutada.

Prohibido: - placeholders/TBD; - tests triviales para inflar coverage; -
silenciar Guardian; - bajar thresholds para ocultar regresiones; -
métricas/SLA/SLO inventados; - documentación presentada como
implementación; - mocks presentados como prueba productiva; - eliminar
funcionalidad para obtener PASS; - reescrituras masivas sin necesidad
demostrada.

Si algo no puede medirse usa `NO MEDIDO` y, si es viable, implementa el
mecanismo para medirlo.

# LOOP PRINCIPAL

En cada iteración:

### INSPECT

Revisa arquitectura, frontend, backend, PostgreSQL, migraciones, RLS,
RPC, Storage, Edge Functions, auth, permisos, integraciones, jobs,
documentos, testing, coverage, performance, observabilidad,
concurrencia, idempotencia, CI/CD, release, rollback, DR, SRE,
mantenibilidad, deuda, Guardian y certificación.

### MEASURE

Obtén evidencia real y mantén baselines versionados.

### FIND GAP

Compara contra Books EEES, Guardian, baselines, lessons, regression
matrix y certification model.

### PRIORITIZE

`P0 seguridad/corrupción/autorización → P1 integridad/concurrencia/disponibilidad/recovery → P2 regresión/testing/contratos → P3 arquitectura/mantenibilidad → P4 performance/observabilidad → P5 optimización no crítica`.

### IMPLEMENT

Corrige causa raíz. Prefiere
`canonical source → reusable primitive → explicit contract → automated protection`.

### TEST

Ejecuta gates proporcionales. Toda regresión relevante recibe protección
automática cuando sea viable.

### GUARD

Si una clase de error puede reaparecer, Guardian/test/audit debe
impedirlo.

### VERIFY

Ejecuta gates reales. Nunca declares PASS sin ejecución.

### DOCUMENT

Actualiza solo documentación viva afectada.

### RE-INSPECT

Si existe otra brecha ejecutable, inicia automáticamente otra iteración.

# OBJETIVOS OBLIGATORIOS RESTANTES

## Production Readiness

Implementa/verifica configuración productiva, environment contract,
health/readiness, dependencias, degradación controlada, aislamiento de
fallas, recovery y deployment validation. Genera baseline real.

## SRE / SLI / SLO

Mide disponibilidad, error rate, latencia, auth, RPC críticas, Edge
Functions, jobs, BUK, documentos, Storage y rutas críticas. No inventes
objetivos. Implementa telemetría faltante cuando sea viable.

## Disaster Recovery

Formaliza y valida backup/restore de PostgreSQL, Storage, configuración,
migraciones y config/secrets inventory; pérdida parcial/completa y
recovery validation. No ejecutes restores destructivos en producción.

## Failure Mode Engineering

Mantén matriz real para Supabase, PostgreSQL, Auth, RLS, Storage, Edge
Functions, BUK, otras integraciones, jobs, documentos, frontend, deploy,
migrations y CI/CD. Cada failure mode: impacto, detección, contención,
recovery, owner, test/audit y playbook.

## Capacity & Scaling

Mide crecimiento de tablas, índices, queries/RPC, batches, jobs,
throughput, concurrencia, API/rate limits, Storage, bundle, memoria
cliente e integraciones. Optimiza solo con evidencia.

## Security Hardening Final

Reaudita desde cero RLS, grants, SECURITY DEFINER/search_path,
service_role, IDOR, auth.uid(), IDs confiados desde cliente, Storage
policies, signed URLs, secrets, logs, Edge Functions, CORS, validation,
privilege escalation, admin overrides y boundaries. Todo crítico debe
cerrarse.

## Database Hardening Final

Audita migraciones, schema drift, constraints, FK, uniques, índices,
funciones, triggers, RPC, grants, RLS, concurrencia, transacciones,
idempotencia, backfills, orphan risks y SQL muerto/duplicado. Nunca
edites migraciones aplicadas; usa forward migrations.

## Contract Hardening

Protege `frontend↔services`, `services↔RPC`, `services↔Edge`,
`Edge↔providers`, `ERP↔BUK`, `ERP↔Storage`, `jobs↔workers`. Contratos
tipados, inputs validados, outputs normalizados, errores clasificados y
contract tests útiles.

## Testing Maturity

Continúa desde P3. Prioriza por riesgo: reglas críticas, permisos,
mappings, cálculos, transiciones, contratos, documentos, integraciones,
regresiones, concurrencia e idempotencia. No persigas 100% global.

## Performance

Mantén baseline. Revisa bundle/chunks/lazy loading/render
cost/queries/network/RPC/payloads/XLSX/PDF/dashboards/listas/caché. Sin
micro-optimizaciones sin impacto.

## Observability

Todo flujo crítico debe responder: qué ocurrió, cuándo, quién, entidad,
dependencia, duración, resultado y recuperación. Implementa correlation
IDs, structured errors, audit trails y señales donde falten.

## Release Engineering

Antes de release exige Guardian, tests, contracts, coverage, TypeScript,
build, migrations, security, route/role, performance, smokes, rollback,
changelog, migration plan y cero blockers críticos. Automatiza lo
viable.

## CI/CD

Revisa workflows: reproducibilidad, least privilege, secrets, fail-fast,
cache seguro, artifacts, migration audit, Guardian, tests, build y
deployment gates. Distingue código de repo de configuración externa
GitHub.

## Maintainability

Mantén P2: 0 archivos críticos sobre umbral Guardian, 0 nuevas
duplicaciones bloqueantes, 0 boundaries nuevos violados. No fragmentes
artificialmente.

## Documentation Governance

Sin Books contradictorios, IDs duplicados, referencias rotas, comandos
ficticios, docs activos obsoletos ni baselines desalineados. Tasks,
lessons, ADRs y playbooks deben representar realidad.

# GUARDIAN FINAL

`npm run guardian:full` debe ser el gate central y verificar/invocar
cuando aplique: consistencia EEES, arquitectura, complejidad, query
keys, migraciones, seguridad DB/RLS, routes/roles, auth matrix,
integrations, regressions, performance, operational/release readiness,
tests, contracts, coverage, route smokes, Edge checks y
TypeScript/build.

Resultado requerido: `0 ERRORS / 0 WARNINGS`. No ocultes deuda.

# ENTERPRISE CERTIFICATION

Cuando no queden gaps ejecutables, certifica desde cero: Architecture,
Database, Security, Frontend, Backend, Modules, Integrations,
Documents/Storage, Testing, Regression Prevention, Performance,
Observability, Concurrency, Idempotency, Production Readiness, SRE, DR,
Release, CI/CD, Maintainability, Documentation Governance y Guardian.

Resultado: - `CERTIFIED` - `CERTIFIED WITH EXTERNAL DEPENDENCIES` -
`NOT CERTIFIED`

Usa `CERTIFIED WITH EXTERNAL DEPENDENCIES` solo si todo lo ejecutable en
repo está cerrado y lo restante depende exclusivamente de
infraestructura/credenciales/config externa. Un blocker crítico nunca se
compensa con scoring.

# DEFINITION OF DONE --- 100%

No termines hasta cumplir:

-   [ ] 0 blockers internos P0/P1
-   [ ] Guardian: 0 errors / 0 warnings
-   [ ] TypeScript PASS
-   [ ] Build PASS
-   [ ] Unit tests PASS
-   [ ] Contract tests PASS
-   [ ] Coverage gate PASS
-   [ ] Migration audit PASS
-   [ ] Security audit PASS
-   [ ] Route/Role PASS
-   [ ] Auth matrix PASS según entorno disponible
-   [ ] Frontend route smoke PASS
-   [ ] Edge checks PASS
-   [ ] Performance baseline PASS
-   [ ] Operational readiness PASS
-   [ ] Release readiness PASS
-   [ ] Disaster Recovery evaluado
-   [ ] Failure Mode Matrix completa
-   [ ] Capacity audit completa
-   [ ] Regression matrix actualizada
-   [ ] No migraciones históricas alteradas
-   [ ] No secrets versionados
-   [ ] No placeholders EEES
-   [ ] No IDs duplicados
-   [ ] No referencias EEES rotas
-   [ ] No deuda crítica sin clasificar
-   [ ] Baselines/playbooks/tasks/lessons/changelog actualizados
-   [ ] `git diff --check` PASS
-   [ ] Enterprise Certification ejecutada

Si una condición ejecutable es falsa: **NO HAS TERMINADO. CONTINÚA EL
LOOP.**

# CIERRE

Antes de finalizar: 1. Ejecuta una auditoría adicional como reviewer
externo. 2. Busca regresiones introducidas por el propio proceso. 3.
Ejecuta nuevamente todos los gates desde estado limpio cuando sea
viable. 4. Revisa `git diff`. 5. Elimina temporales. 6. Actualiza
baselines. 7. Genera: -
`eees/audits/EEES-100-PERCENT-CLOSURE-REPORT.md` -
`eees/certification/ENTERPRISE-CERTIFICATION-FINAL.md` -
`eees/audits/FINAL-RESIDUAL-RISK-REGISTER.md` 8. Si corresponde:
`artifacts/EEES_ENTERPRISE_100_FINAL.zip`.

Realiza commits atómicos y trazables cuando sea seguro. No force-push ni
reescribas historial.

# RESPUESTA FINAL ÚNICA

EEES ENTERPRISE 100%: CERTIFIED / CERTIFIED WITH EXTERNAL DEPENDENCIES /
NOT CERTIFIED

Loops ejecutados: `<n>`{=html} Gaps detectados: `<n>`{=html} Gaps
cerrados: `<n>`{=html} Blockers internos restantes: `<n>`{=html}
Dependencias externas restantes: `<n>`{=html}

Guardian warnings: `<n>`{=html} Guardian errors: `<n>`{=html}

Unit Tests: PASS/FAIL Contract Tests: PASS/FAIL Coverage: PASS/FAIL
Migrations: PASS/FAIL Security: PASS/FAIL Route/Role: PASS/FAIL
Performance: PASS/FAIL Operational Readiness: PASS/FAIL Release
Readiness: PASS/FAIL Disaster Recovery: PASS/FAIL/EXTERNAL TypeScript:
PASS/FAIL Build: PASS/FAIL Affected Smokes: PASS/FAIL git diff --check:
PASS/FAIL

Enterprise Certification: `<resultado>`{=html}

Reporte maestro: eees/audits/EEES-100-PERCENT-CLOSURE-REPORT.md

Certificación: eees/certification/ENTERPRISE-CERTIFICATION-FINAL.md

Riesgo residual: eees/audits/FINAL-RESIDUAL-RISK-REGISTER.md

## COMIENZA AHORA

No ejecutes una fase y te detengas. Ejecuta el loop hasta alcanzar el
Definition of Done o demostrar exclusivamente blockers externos reales.
