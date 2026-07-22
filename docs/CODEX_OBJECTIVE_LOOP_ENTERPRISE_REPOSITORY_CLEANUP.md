# CODEX OBJECTIVE LOOP --- ENTERPRISE REPOSITORY CLEANUP & CONSOLIDATION

## OBJETIVO ÚNICO

Ejecuta una limpieza final, segura y verificable del repositorio después
del cierre EEES 100%.

Objetivo final:

**eliminar exclusivamente residuos demostrablemente innecesarios,
consolidar la fuente canónica y dejar el ERP más pequeño, coherente y
mantenible SIN alterar comportamiento funcional, contratos públicos,
datos ni gobierno EEES.**

Ejecuta autónomamente:

`BASELINE → DISCOVER → PROVE → CLASSIFY → REMOVE/CONSOLIDATE → TEST → GUARD → RE-SCAN → REPEAT`

No te detengas entre iteraciones.

------------------------------------------------------------------------

## BOOT OBLIGATORIO

Lee completos antes de modificar:

-   `AGENTS.md`
-   `eees/codex/BOOT_SEQUENCE.md`
-   `eees/audits/EEES-100-PERCENT-CLOSURE-REPORT.md`
-   `eees/certification/ENTERPRISE-CERTIFICATION-FINAL.md`
-   `eees/audits/FINAL-RESIDUAL-RISK-REGISTER.md`
-   `tasks/todo.md`
-   `tasks/lessons.md`
-   Books, baselines y Guardian aplicables.

Mantén intactas las cinco dependencias externas ya clasificadas salvo
que exista evidencia nueva que permita cerrarlas. No las conviertas
artificialmente en deuda interna.

------------------------------------------------------------------------

# REGLA MAESTRA DE SEGURIDAD

**ANTE DUDA, NO BORRAR.**

Nada se elimina solo porque: - parezca antiguo; - tenga nombre
`legacy`; - no aparezca en una búsqueda simple; - exista una
implementación aparentemente mejor; - un analizador estático lo marque
como unused.

Antes de eliminar, demuestra ausencia de consumidores considerando:

-   imports estáticos;
-   imports dinámicos;
-   lazy loading;
-   rutas;
-   registries;
-   strings;
-   configuración;
-   scripts;
-   CI/CD;
-   SQL/RPC;
-   Edge Functions;
-   Storage;
-   tests;
-   jobs;
-   runtime conventions;
-   referencias documentales;
-   integraciones externas.

Git conserva historial, pero no es excusa para eliminar sin evidencia.

------------------------------------------------------------------------

# BASELINE PREVIO

Antes de limpiar registra:

-   número de archivos versionados;
-   LOC por categorías relevantes;
-   dependencias directas/dev;
-   scripts npm;
-   rutas;
-   módulos;
-   componentes/hooks/services/helpers/types;
-   tests;
-   Edge Functions;
-   RPC/functions;
-   tamaño de `dist`;
-   Guardian errors/warnings;
-   resultados de gates.

Genera:

`eees/baselines/REPOSITORY-CLEANUP-BASELINE_v1.md`

No inventes métricas.

------------------------------------------------------------------------

# SUPERFICIES A AUDITAR

## 1. Código muerto

Busca y valida:

-   componentes sin consumidores;
-   hooks sin consumidores;
-   services/helpers/types sin consumidores;
-   exports/imports muertos;
-   funciones/constants/enums no utilizados;
-   branches imposibles;
-   adapters reemplazados;
-   código comentado obsoleto;
-   archivos superseded.

No elimines APIs públicas solo por no tener consumidor interno si pueden
pertenecer a un contrato externo.

## 2. Duplicación residual

Detecta implementaciones equivalentes posteriores a P2/P3.

Consolida solo cuando exista una fuente canónica clara y la
consolidación reduzca complejidad real.

No crees abstracciones innecesarias.

## 3. Dependencias

Audita `dependencies` y `devDependencies`.

Para cada candidata: - demuestra ausencia de
imports/runtime/scripts/build/config; - considera dependencias CLI y
tooling; - elimina solo con evidencia; - actualiza lockfile
correctamente.

Prohibido editar lockfile manualmente para simular limpieza.

## 4. Scripts y tooling

Audita: - scripts npm; - scripts internos; - auditores; - herramientas
temporales; - comandos superseded.

Guardian y los gates EEES vigentes son infraestructura protegida.

No elimines un auditor porque otro lo invoque indirectamente.

## 5. Tests

Elimina únicamente: - tests duplicados sin protección adicional; -
fixtures realmente huérfanos; - helpers superseded.

Nunca reduzcas cobertura anti-regresión para disminuir LOC.

## 6. Frontend

Audita: - rutas obsoletas; - componentes legacy; - assets; - styles; -
feature flags; - query factories; - loaders; - barrels; - exports.

Verifica imports dinámicos y rutas antes de borrar.

## 7. Backend / Supabase

Audita: - Edge Functions; - helpers compartidos; - RPC; - SQL
functions; - triggers; - policies; - grants; - tipos; - adapters.

### Regla SQL absoluta

**NO editar, borrar ni reescribir migraciones históricas aplicadas.**

Si un objeto DB actual es realmente obsoleto y su eliminación está
demostrada: - crea forward migration; - evalúa dependencias; - documenta
rollback/recovery; - ejecuta migration/security audits.

No elimines objetos DB únicamente porque no haya referencias frontend.

## 8. Documentación

Reconcilia:

`EEES = norma` `docs = descripción` `tasks = ejecución/lecciones`

Clasifica documentos como: - ACTIVE - SUPERSEDED - HISTORICAL - REMOVE

Elimina solo duplicación sin valor histórico/operacional.

No borres: - closure reports; - ADRs vigentes/históricos necesarios; -
baselines requeridos para trazabilidad; - evidencia de certificación; -
playbooks activos; - lessons reutilizables.

Si un documento antiguo debe conservarse por trazabilidad, márcalo
superseded/historical en vez de borrarlo.

## 9. Artifacts y residuos

Detecta: - temporales; - dumps; - outputs accidentales; - archivos
generados versionados sin necesidad; - backups locales; - caches; -
artifacts duplicados.

Respeta `.gitignore` y política del repositorio.

## 10. Comentarios y compatibilidad legacy

Elimina comentarios obsoletos y shims únicamente cuando: - la
compatibilidad ya no sea requerida; - exista evidencia; - tests/gates
protejan la eliminación.

------------------------------------------------------------------------

# CLASIFICACIÓN OBLIGATORIA

Cada candidato relevante debe clasificarse:

-   `REMOVE_CONFIRMED`
-   `CONSOLIDATE`
-   `KEEP_ACTIVE`
-   `KEEP_PUBLIC_CONTRACT`
-   `KEEP_RUNTIME_DYNAMIC`
-   `KEEP_HISTORICAL`
-   `KEEP_UNCERTAIN`

Solo `REMOVE_CONFIRMED` puede borrarse.

Genera:

`eees/audits/REPOSITORY-CLEANUP-INVENTORY.md`

Para cada eliminación material registra evidencia y validación.

------------------------------------------------------------------------

# LOOP DE ELIMINACIÓN

Trabaja en lotes pequeños y coherentes.

Para cada lote:

1.  demuestra candidatos;
2.  registra clasificación;
3.  elimina/consolida;
4.  ejecuta TypeScript;
5.  ejecuta tests afectados;
6.  ejecuta contract tests afectados;
7.  ejecuta smokes afectados;
8.  ejecuta audits afectados;
9.  ejecuta `git diff --check`;
10. ejecuta Guardian correspondiente;
11. compara contra baseline;
12. si aparece regresión, revierte/corrige antes de continuar.

No acumules una purga masiva antes de validar.

------------------------------------------------------------------------

# PROTECCIÓN CONTRA REGRESIÓN

La limpieza no puede degradar:

-   funcionalidad;
-   permisos;
-   contratos;
-   coverage útil;
-   performance;
-   observabilidad;
-   idempotencia;
-   recovery;
-   EEES;
-   Guardian;
-   CI/CD.

Si descubres una clase de residuo recurrente que puede detectarse
automáticamente, agrega una regla Guardian/audit razonable para impedir
su reintroducción.

No conviertas Guardian en un detector ruidoso de falsos positivos.

------------------------------------------------------------------------

# OBJETIVO DE COMPACTACIÓN

Busca reducción real de:

-   archivos innecesarios;
-   LOC innecesarias;
-   dependencias innecesarias;
-   superficies duplicadas;
-   documentación redundante;
-   paths legacy.

**No existe meta porcentual.**

Una reducción de 0% es válida si no existe residuo demostrable.

Nunca sacrifiques arquitectura, legibilidad o testabilidad para reportar
una reducción mayor.

------------------------------------------------------------------------

# VALIDACIÓN FINAL

Cuando no queden candidatos `REMOVE_CONFIRMED` ni `CONSOLIDATE`
ejecutables, realiza un segundo scan desde cero.

Después ejecuta como mínimo:

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

Además ejecuta: - migration audit; - security audit; - route/role
audit; - performance audit; - operational readiness; - release
readiness; - todos los gates afectados por eliminaciones.

No declares PASS sin ejecución.

------------------------------------------------------------------------

# CRITERIO DE CIERRE

Solo termina cuando:

-   [ ] 0 candidatos `REMOVE_CONFIRMED` pendientes
-   [ ] 0 candidatos `CONSOLIDATE` pendientes dentro del alcance seguro
-   [ ] 0 referencias rotas
-   [ ] 0 dependencias confirmadamente unused
-   [ ] 0 scripts temporales confirmados
-   [ ] 0 artifacts accidentales confirmados
-   [ ] 0 documentación activa duplicada confirmada
-   [ ] 0 código muerto confirmado pendiente
-   [ ] 0 migraciones históricas modificadas
-   [ ] 0 contratos públicos eliminados sin evidencia
-   [ ] Guardian 0 errors / 0 warnings
-   [ ] Unit Tests PASS
-   [ ] Contract Tests PASS
-   [ ] Coverage PASS
-   [ ] Migrations PASS
-   [ ] Security PASS
-   [ ] Route/Role PASS
-   [ ] Performance PASS
-   [ ] Operational Readiness PASS
-   [ ] Release Readiness PASS
-   [ ] TypeScript PASS
-   [ ] Build PASS
-   [ ] Affected Smokes PASS
-   [ ] `git diff --check` PASS
-   [ ] EEES consistency PASS

Si algún punto ejecutable falla: **CONTINÚA EL LOOP.**

------------------------------------------------------------------------

# ENTREGABLES

Genera/actualiza:

-   `eees/baselines/REPOSITORY-CLEANUP-BASELINE_v1.md`
-   `eees/audits/REPOSITORY-CLEANUP-INVENTORY.md`
-   `eees/audits/REPOSITORY-CLEANUP-CLOSURE-REPORT.md`
-   `tasks/todo.md`
-   `tasks/lessons.md`
-   `eees/CHANGELOG.md`
-   Guardian únicamente si surge una protección anti-residuo de alto
    valor.

No abras una nueva fase EEES después de esto.

------------------------------------------------------------------------

# REPORTE FINAL

Debe cuantificar, usando evidencia:

-   archivos eliminados;
-   archivos consolidados;
-   LOC antes/después;
-   dependencias antes/después;
-   scripts antes/después;
-   documentos eliminados/consolidados/históricos;
-   código muerto eliminado;
-   duplicaciones eliminadas;
-   tamaño build antes/después;
-   objetos DB removidos mediante forward migration, si existieron;
-   Guardian antes/después;
-   cualquier candidato conservado por incertidumbre.

`KEEP_UNCERTAIN` no es fracaso: es preferible conservar código a
destruir una dependencia dinámica no demostrada.

------------------------------------------------------------------------

# COMMITS

Usa commits atómicos por superficies coherentes.

No force push. No reescribas historial. No mezcles limpieza con nuevas
funcionalidades.

------------------------------------------------------------------------

# RESPUESTA FINAL ÚNICA

Responde únicamente:

``` text
ENTERPRISE REPOSITORY CLEANUP: COMPLETE / BLOCKED

Archivos eliminados: <n>
Archivos consolidados: <n>
LOC antes: <n>
LOC después: <n>
Dependencias eliminadas: <n>
Scripts eliminados: <n>
Documentos eliminados/consolidados: <n>
Código muerto confirmado pendiente: <n>
KEEP_UNCERTAIN: <n>

Guardian warnings: <n>
Guardian errors: <n>

Unit Tests: PASS/FAIL
Contract Tests: PASS/FAIL
Coverage: PASS/FAIL
Migrations: PASS/FAIL
Security: PASS/FAIL
Route/Role: PASS/FAIL
Performance: PASS/FAIL
Operational Readiness: PASS/FAIL
Release Readiness: PASS/FAIL
TypeScript: PASS/FAIL
Build: PASS/FAIL
Affected Smokes: PASS/FAIL
EEES Consistency: PASS/FAIL
git diff --check: PASS/FAIL

Reporte:
eees/audits/REPOSITORY-CLEANUP-CLOSURE-REPORT.md
```

## COMIENZA AHORA

Ejecuta el loop completo. No te detengas entre auditoría, limpieza y
validación. El objetivo es un repositorio limpio y consolidado con
**cero residuo confirmado pendiente**, no conseguir una cifra artificial
de reducción.
