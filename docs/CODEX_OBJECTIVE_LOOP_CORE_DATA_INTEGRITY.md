# CODEX OBJECTIVE LOOP --- CORE DATA INTEGRITY CERTIFICATION

## OBJETIVO ÚNICO

Actúa como **Principal ERP Architect + PostgreSQL/Supabase Architect +
Distributed Systems Engineer + Security Engineer**.

Realiza una revisión adversarial y ejecutoria del núcleo transaccional
del ERP hasta responder con evidencia:

> **¿Puede el ERP quedar en un estado de datos incorrecto, imposible,
> parcial, duplicado o inconsistente aunque TypeScript compile, Guardian
> pase y la UI aparentemente funcione?**

No quiero otra auditoría general ni optimización cosmética.

Tu misión es encontrar y cerrar fallas profundas de:

-   invariantes de negocio;
-   integridad referencial;
-   transacciones;
-   concurrencia;
-   idempotencia;
-   atomicidad;
-   autorización a nivel de datos;
-   contratos frontend/backend;
-   RPC;
-   RLS;
-   jobs;
-   retries;
-   sincronizaciones;
-   documentos;
-   estados de workflow;
-   consistencia entre módulos.

Ejecuta autónomamente:

`MAP → MODEL → ATTACK → PROVE → FIX → TEST → GUARD → RE-ATTACK → CERTIFY`

Repite hasta alcanzar:

**CORE DATA INTEGRITY: CERTIFIED**

o demostrar exclusivamente dependencias externas reales.

------------------------------------------------------------------------

# 1. BOOT OBLIGATORIO

Antes de modificar código lee completos:

-   `AGENTS.md`
-   `eees/codex/BOOT_SEQUENCE.md`
-   `tasks/todo.md`
-   `tasks/lessons.md`
-   Books EEES aplicables
-   baselines vigentes
-   regression matrix
-   security/database hardening reports
-   certification final
-   residual risk register
-   repository cleanup closure report

Después inspecciona el código real.

No asumas que un PASS anterior demuestra integridad transaccional.

------------------------------------------------------------------------

# 2. REGLA CENTRAL

No preguntes:

> "¿Funciona este endpoint?"

Pregunta:

> "¿Qué estados inválidos puede producir este conjunto de operaciones
> cuando hay errores parciales, concurrencia, retries, doble submit,
> datos antiguos, permisos distintos o dependencias externas
> degradadas?"

El código es evidencia, no garantía.

------------------------------------------------------------------------

# 3. AUTONOMÍA

No pidas aprobación entre hallazgos.

Puedes modificar:

-   TypeScript;
-   services;
-   hooks cuando sea necesario;
-   RPC;
-   funciones PostgreSQL;
-   constraints;
-   índices;
-   triggers cuando estén justificados;
-   RLS/policies;
-   Edge Functions;
-   jobs;
-   tests;
-   audits;
-   Guardian;
-   documentación EEES.

### Regla SQL absoluta

**Nunca edites migraciones históricas aplicadas.**

Toda modificación DB usa forward migration nueva, segura, idempotente
cuando corresponda y auditable.

Detente solo ante: - operación destructiva sobre producción; - decisión
de negocio imposible de inferir; - credencial externa imprescindible; -
dependencia externa inaccesible; - cambio irreversible que requiera
aprobación humana.

Aísla el blocker y continúa con el resto.

------------------------------------------------------------------------

# 4. CONSTRUIR EL MAPA TRANSACCIONAL

Identifica todos los flujos que crean, modifican, aprueban, rechazan,
sincronizan, eliminan lógica/físicamente o generan documentos.

Prioriza al menos:

-   trabajadores;
-   contratación/reclutamiento;
-   alta operacional;
-   competencias;
-   certificados;
-   incentivos;
-   operaciones;
-   registros de servicios;
-   acreditaciones;
-   documentos;
-   BUK;
-   jobs/syncs;
-   usuarios/roles/permisos;
-   cualquier flujo financiero o contractual encontrado.

Para cada flujo documenta:

``` text
Actor
Entry point
Frontend
Service
RPC / Edge Function
Tables
Storage
External provider
State transitions
Authorization
Side effects
Retry behavior
Failure behavior
Recovery behavior
```

Genera:

`eees/audits/CORE-TRANSACTION-MAP.md`

------------------------------------------------------------------------

# 5. INVARIANTES DE NEGOCIO

Extrae las reglas que SIEMPRE deben ser verdaderas.

Ejemplos conceptuales, no asumirlos sin evidencia:

-   una entidad activa requiere parent válido;
-   un certificado no puede existir sin evaluación requerida;
-   una aprobación no puede ejecutarse dos veces;
-   una transición de estado debe partir de un estado permitido;
-   una operación no puede pertenecer simultáneamente a estados
    incompatibles;
-   una relación 1:1 no puede duplicarse;
-   un documento obligatorio debe existir antes de cierto estado;
-   un registro sincronizado no puede perder identidad externa;
-   un usuario no puede modificar una entidad fuera de su scope.

Clasifica cada invariante:

-   DB_ENFORCED
-   TRANSACTION_ENFORCED
-   RPC_ENFORCED
-   SERVICE_ONLY
-   UI_ONLY
-   NOT_ENFORCED
-   UNKNOWN

Prioridad crítica:

**UI_ONLY y NOT_ENFORCED para reglas que protegen integridad.**

Genera:

`eees/audits/DOMAIN-INVARIANT-MATRIX.md`

------------------------------------------------------------------------

# 6. STATE MACHINE REVIEW

Para cada workflow relevante:

1.  identifica estados reales;
2.  identifica transiciones válidas;
3.  identifica transiciones imposibles;
4.  busca updates directos que salten reglas;
5.  busca estados terminales reversibles accidentalmente;
6.  busca carreras entre aprobación/rechazo/cancelación;
7.  busca estados intermedios sin recovery;
8.  busca strings libres donde debiera existir dominio controlado.

Cuando tenga valor, centraliza transición mediante RPC/service canónico.

No sobreingenierices workflows simples.

------------------------------------------------------------------------

# 7. ATOMICIDAD

Busca operaciones lógicamente únicas implementadas como múltiples
escrituras independientes.

Ejemplo:

``` text
insert A
insert B
upload document
update status
write audit
```

Pregunta qué ocurre si falla cada paso.

Clasifica:

-   ATOMIC
-   COMPENSATED
-   RECOVERABLE
-   PARTIAL_STATE_RISK

Para `PARTIAL_STATE_RISK` crítico:

-   usa transacción PostgreSQL cuando todo sea DB;
-   usa patrón de compensación/recovery cuando intervengan servicios
    externos;
-   registra estado explícito cuando la operación sea distribuida;
-   nunca simules transacción distribuida inexistente.

------------------------------------------------------------------------

# 8. CONCURRENCIA

Ataca los flujos como si dos o más actores actuaran simultáneamente.

Busca:

-   check-then-insert;
-   read-modify-write;
-   approvals concurrentes;
-   doble submit;
-   workers simultáneos;
-   retries paralelos;
-   generación duplicada;
-   secuencias manuales;
-   counters;
-   upserts ambiguos;
-   selección de jobs sin locking;
-   pérdida de actualización.

Evalúa herramientas apropiadas:

-   UNIQUE constraints;
-   conditional UPDATE;
-   UPSERT;
-   `FOR UPDATE`;
-   `SKIP LOCKED`;
-   advisory locks solo cuando estén justificados;
-   optimistic concurrency/version;
-   idempotency keys.

No agregues locks globales innecesarios.

------------------------------------------------------------------------

# 9. IDEMPOTENCIA

Toda mutación crítica susceptible de retry debe responder:

> ¿Qué ocurre si exactamente la misma solicitud llega 2, 5 o 20 veces?

Audita especialmente:

-   Edge Functions;
-   sync BUK;
-   upload documental;
-   generación de certificados;
-   batch operations;
-   jobs;
-   registros operacionales;
-   aprobaciones;
-   webhooks si existen.

Clasifica:

-   NATURALLY_IDEMPOTENT
-   IDEMPOTENCY_KEY
-   UNIQUE_GUARDED
-   REPLAY_SAFE
-   NOT_IDEMPOTENT
-   UNKNOWN

Corrige `NOT_IDEMPOTENT` cuando pueda generar corrupción o duplicación.

------------------------------------------------------------------------

# 10. REFERENTIAL & DOMAIN INTEGRITY

Audita DB real:

-   PK;
-   FK;
-   UNIQUE;
-   NOT NULL;
-   CHECK;
-   enums/domain constraints;
-   cascades;
-   orphan risk;
-   soft delete;
-   duplicate logical identities;
-   external IDs;
-   timestamps;
-   ownership;
-   tenant/scope relationships.

No agregues constraints sin verificar datos existentes.

Antes de una constraint nueva:

1.  detecta datos incompatibles;
2.  define remediation;
3.  usa forward migration;
4.  evita downtime cuando sea posible;
5.  valida rollback/recovery.

------------------------------------------------------------------------

# 11. AUTHORIZATION AS DATA INTEGRITY

No limites seguridad a "puede abrir la pantalla".

Verifica que un actor no pueda:

-   modificar otra entidad alterando IDs;
-   ejecutar RPC con scope ajeno;
-   saltar workflow;
-   falsificar owner/user_id;
-   seleccionar otro trabajador/contrato fuera de permiso;
-   usar RPC SECURITY DEFINER para elevar privilegios;
-   acceder a Storage ajeno;
-   modificar estados terminales.

La autorización crítica debe existir en backend/DB, no depender
exclusivamente de UI.

------------------------------------------------------------------------

# 12. RPC REVIEW

Para cada RPC crítica analiza:

-   auth;
-   input trust;
-   ownership;
-   transaction boundaries;
-   locking;
-   constraints;
-   search_path;
-   SECURITY DEFINER;
-   grants;
-   exception handling;
-   partial writes;
-   returned contract;
-   retries;
-   duplicate execution.

Busca reglas duplicadas entre RPCs.

Prefiere una implementación canónica por regla de negocio.

------------------------------------------------------------------------

# 13. RLS REVIEW

Revisa nuevamente RLS desde perspectiva de consistencia.

Busca combinaciones donde:

-   INSERT está protegido pero UPDATE no;
-   SELECT oculta datos pero RPC privilegiada los modifica;
-   ownership puede cambiarse;
-   foreign IDs permiten escapar scope;
-   service_role bypass carece de boundary;
-   policies difieren entre tablas relacionadas.

No confíes solo en auditorías anteriores.

------------------------------------------------------------------------

# 14. EXTERNAL CONSISTENCY --- BUK Y OTRAS INTEGRACIONES

Para cada integración identifica:

-   sistema source of truth;
-   identidad local/externa;
-   sync direction;
-   duplicate prevention;
-   replay behavior;
-   stale data;
-   deletion behavior;
-   conflict resolution;
-   retries;
-   timeout;
-   partial success;
-   reconciliation.

Pregunta:

> ¿Qué ocurre si el proveedor responde éxito pero el ERP falla antes de
> persistirlo?

y:

> ¿Qué ocurre si ERP persiste pero el proveedor nunca recibe la
> operación?

Implementa reconciliation/recovery cuando el riesgo lo justifique.

------------------------------------------------------------------------

# 15. DOCUMENT & STORAGE INTEGRITY

Valida consistencia entre metadata DB y Storage.

Busca:

-   DB row sin archivo;
-   archivo sin DB row;
-   reemplazo parcial;
-   duplicación;
-   signed URLs incorrectas;
-   nombre/path no determinista;
-   upload exitoso + DB fallido;
-   DB exitoso + upload fallido;
-   eliminación inconsistente.

Implementa detección/recovery cuando sea crítico.

------------------------------------------------------------------------

# 16. JOBS / QUEUES

Audita:

-   claim;
-   ownership;
-   locking;
-   retries;
-   max attempts;
-   stale processing;
-   dead-letter behavior;
-   partial success;
-   duplicate workers;
-   poison jobs;
-   observability;
-   manual recovery.

Un worker debe poder morir en cualquier instrucción sin dejar corrupción
permanente.

------------------------------------------------------------------------

# 17. TEMPORAL CONSISTENCY

Busca reglas dependientes de tiempo:

-   vigencias;
-   expiraciones;
-   periodos;
-   cierres;
-   fechas contractuales;
-   timezone;
-   `now()` vs client time;
-   fechas locales Chile;
-   jobs programados.

Evita que el cliente sea autoridad para timestamps críticos cuando no
corresponda.

------------------------------------------------------------------------

# 18. NUMERIC & FINANCIAL INTEGRITY

Si existen montos, porcentajes, incentivos, horas, costos u otros
cálculos:

-   identifica fuente canónica;
-   revisa precision;
-   rounding;
-   numeric vs float;
-   duplicación frontend/backend;
-   null/zero semantics;
-   límites;
-   recalculation drift.

No cambies reglas económicas sin evidencia inequívoca.

Si una regla de negocio no puede inferirse, clasifica como BLOCKER
BUSINESS y continúa con el resto.

------------------------------------------------------------------------

# 19. ADVERSARIAL SCENARIOS

Crea escenarios reales de fallo para cada flujo crítico.

Como mínimo evalúa:

``` text
double click / double submit
same request replay
two approvers simultaneously
worker crash after claim
timeout after provider success
provider failure after local success
network retry
stale browser state
permission changed mid-session
duplicate external ID
missing required document
invalid state transition
concurrent update
partial batch failure
Storage failure
RPC exception after intermediate write
```

Automatiza los escenarios de mayor riesgo.

------------------------------------------------------------------------

# 20. TESTING

No busques aumentar coverage global.

Agrega tests que prueben invariantes.

Prioridad:

1.  DB/SQL tests para constraints y transacciones;
2.  contract tests para RPC;
3.  concurrency tests;
4.  idempotency/replay tests;
5.  integration tests;
6.  unit tests para reglas puras;
7.  E2E solo cuando aporte cobertura que capas inferiores no pueden dar.

Cada gap crítico cerrado debe tener protección anti-regresión cuando sea
viable.

------------------------------------------------------------------------

# 21. GUARDIAN --- CORE INTEGRITY

Extiende Guardian solo con controles de alto valor.

Debe impedir la reintroducción verificable de:

-   reglas críticas UI-only;
-   RPC inseguras;
-   funciones SECURITY DEFINER sin estándar;
-   mutaciones críticas sin protección definida;
-   constraints eliminadas accidentalmente;
-   state-machine bypasses detectables;
-   jobs sin recovery requerido;
-   cambios que invaliden matrices de invariantes.

Evita heurísticas ruidosas.

------------------------------------------------------------------------

# 22. CANONICAL BUSINESS LOGIC

Detecta reglas críticas implementadas múltiples veces.

Jerarquía objetivo:

``` text
DB invariant
↓
canonical backend/RPC/domain service
↓
typed frontend service
↓
UI
```

No dupliques una regla crítica en UI como única defensa.

La UI puede validar para UX, pero backend/DB protege integridad.

------------------------------------------------------------------------

# 23. DATA MIGRATION SAFETY

Si una corrección requiere migración:

-   forward-only;
-   preflight;
-   compatible con datos existentes;
-   backfill controlado;
-   constraint posterior cuando corresponda;
-   índices apropiados;
-   lock/downtime evaluado;
-   audit:migrations PASS;
-   security audit PASS;
-   recovery documentado.

Nunca modifiques una migración aplicada.

------------------------------------------------------------------------

# 24. EVIDENCIA

Para cada gap registra:

``` text
ID
Severity
Domain
Invariant violated
Evidence
Failure scenario
Root cause
Fix
Protection
Validation
Residual risk
```

Genera:

`eees/audits/CORE-DATA-INTEGRITY-FINDINGS.md`

No registres mejoras cosméticas como gaps de integridad.

------------------------------------------------------------------------

# 25. CERTIFICATION MATRIX

Genera:

`eees/certification/CORE-DATA-INTEGRITY-CERTIFICATION.md`

Evalúa:

-   Domain invariants
-   State transitions
-   Referential integrity
-   Atomicity
-   Concurrency
-   Idempotency
-   Authorization integrity
-   RPC integrity
-   RLS integrity
-   External consistency
-   Document/Storage consistency
-   Jobs/recovery
-   Temporal integrity
-   Numeric integrity
-   Regression protection

Cada dominio:

-   CERTIFIED
-   CERTIFIED_WITH_EXTERNAL_DEPENDENCY
-   NOT_CERTIFIED

Un P0/P1 interno abierto implica `NOT_CERTIFIED`.

------------------------------------------------------------------------

# 26. LOOP DE CIERRE

Después de implementar todos los gaps encontrados:

1.  vuelve a construir el mapa;
2.  vuelve a extraer invariantes;
3.  vuelve a ejecutar escenarios adversariales;
4.  busca nuevos estados imposibles introducidos por fixes;
5.  ejecuta Guardian;
6.  ejecuta tests;
7.  reaudita SQL/RLS/RPC;
8.  repite mientras aparezca un gap interno ejecutable.

No te detengas después de la primera pasada.

------------------------------------------------------------------------

# 27. VALIDACIÓN FINAL

Ejecuta como mínimo:

``` bash
npm run guardian:full
npm run test:unit
npm run test:contracts
npm run test:coverage
npx tsc -b --pretty false
npm run build
npm run smoke:frontend-routes
git diff --check
```

Además:

-   migration audit;
-   security audit;
-   route/role audit;
-   authenticated matrix según entorno;
-   nuevos integrity tests;
-   concurrency tests;
-   idempotency tests;
-   RPC/SQL tests;
-   Storage/document tests cuando existan;
-   todos los gates afectados.

No declares PASS sin ejecutar.

------------------------------------------------------------------------

# 28. DEFINITION OF DONE

Solo certifica cuando:

-   [ ] todos los flujos críticos están mapeados
-   [ ] invariantes críticas identificadas
-   [ ] 0 invariantes críticas dependen exclusivamente de UI
-   [ ] 0 estados imposibles conocidos sin protección
-   [ ] 0 riesgos internos P0/P1 de atomicidad
-   [ ] 0 riesgos internos P0/P1 de concurrencia
-   [ ] 0 mutaciones críticas replay-unsafe sin clasificación
-   [ ] integridad referencial crítica protegida
-   [ ] autorización crítica protegida backend/DB
-   [ ] RPC críticas revisadas
-   [ ] RLS crítica revisada
-   [ ] jobs críticos tienen recovery
-   [ ] integraciones críticas tienen estrategia de reconciliation
-   [ ] documentos críticos tienen estrategia de consistencia DB/Storage
-   [ ] reglas temporales críticas usan autoridad correcta
-   [ ] cálculos críticos tienen fuente canónica
-   [ ] cada gap crítico corregido tiene anti-regresión cuando sea
    viable
-   [ ] Guardian 0 errors
-   [ ] Guardian 0 warnings
-   [ ] Unit Tests PASS
-   [ ] Contract Tests PASS
-   [ ] Integrity Tests PASS
-   [ ] Concurrency Tests PASS
-   [ ] Idempotency Tests PASS
-   [ ] Migrations PASS
-   [ ] Security PASS
-   [ ] Route/Role PASS
-   [ ] TypeScript PASS
-   [ ] Build PASS
-   [ ] Affected Smokes PASS
-   [ ] EEES Consistency PASS
-   [ ] `git diff --check` PASS

Si alguna condición interna ejecutable falla:

**NO HAS TERMINADO. CONTINÚA EL LOOP.**

------------------------------------------------------------------------

# 29. NO DEGRADAR EL ESTADO ACTUAL

El repositorio parte desde EEES Enterprise certificado y cleanup
completo.

No aceptes como tradeoff:

-   nuevos Guardian warnings;
-   reducción injustificada de coverage;
-   incremento de duplicación;
-   archivos críticos gigantes;
-   eliminación de tests útiles;
-   bypass EEES;
-   degradación performance material;
-   cambio funcional no requerido.

Si una mejora de integridad exige un cambio arquitectónico relevante,
crea ADR.

------------------------------------------------------------------------

# 30. ENTREGABLES

Genera/actualiza:

-   `eees/audits/CORE-TRANSACTION-MAP.md`
-   `eees/audits/DOMAIN-INVARIANT-MATRIX.md`
-   `eees/audits/CORE-DATA-INTEGRITY-FINDINGS.md`
-   `eees/audits/CORE-DATA-INTEGRITY-CLOSURE-REPORT.md`
-   `eees/certification/CORE-DATA-INTEGRITY-CERTIFICATION.md`
-   tests/audits/Guardian necesarios
-   `tasks/todo.md`
-   `tasks/lessons.md`
-   `eees/CHANGELOG.md`
-   baselines afectados
-   ADRs cuando corresponda.

No abras otra iniciativa después de completar este objetivo.

------------------------------------------------------------------------

# 31. RESPUESTA FINAL ÚNICA

Responde únicamente:

``` text
CORE DATA INTEGRITY: CERTIFIED / CERTIFIED WITH EXTERNAL DEPENDENCIES / NOT CERTIFIED

Loops ejecutados: <n>
Flujos críticos mapeados: <n>
Invariantes críticas: <n>
Gaps detectados: <n>
Gaps cerrados: <n>
P0 internos restantes: <n>
P1 internos restantes: <n>

Atomicity: PASS/FAIL
Concurrency: PASS/FAIL
Idempotency: PASS/FAIL
Referential Integrity: PASS/FAIL
Authorization Integrity: PASS/FAIL
RPC/RLS Integrity: PASS/FAIL
External Consistency: PASS/FAIL/EXTERNAL
Document/Storage Integrity: PASS/FAIL/EXTERNAL
Jobs/Recovery: PASS/FAIL
Temporal Integrity: PASS/FAIL
Numeric Integrity: PASS/FAIL

Guardian warnings: <n>
Guardian errors: <n>

Unit Tests: PASS/FAIL
Contract Tests: PASS/FAIL
Integrity Tests: PASS/FAIL
Concurrency Tests: PASS/FAIL
Idempotency Tests: PASS/FAIL
Migrations: PASS/FAIL
Security: PASS/FAIL
Route/Role: PASS/FAIL
TypeScript: PASS/FAIL
Build: PASS/FAIL
Affected Smokes: PASS/FAIL
EEES Consistency: PASS/FAIL
git diff --check: PASS/FAIL

Certificación:
eees/certification/CORE-DATA-INTEGRITY-CERTIFICATION.md

Reporte:
eees/audits/CORE-DATA-INTEGRITY-CLOSURE-REPORT.md
```

# COMIENZA AHORA

No hagas una auditoría superficial y te detengas.

**Ataca el ERP como un sistema transaccional adversarial y continúa el
loop hasta demostrar que los datos no pueden entrar en estados inválidos
conocidos bajo fallos, retries y concurrencia, o hasta aislar
exclusivamente dependencias externas reales.**
