---
document_id: EEES-AUDIT-REPOSITORY-CLEANUP-CLOSURE
title: Repository Cleanup Closure Report
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Repository Cleanup Closure Report

## Resultado

COMPLETE.

## Resumen

- Archivos eliminados: 26.
- Archivos consolidados: 3 CSV duplicados cerrados al eliminar la copia runtime huerfana.
- LOC antes: 44.403.
- LOC despues: 44.250.
- Dependencias antes: 18 directas y 9 dev.
- Dependencias despues: 15 directas y 9 dev.
- Scripts npm antes/despues: 31/32.
- Scripts propios `.mjs` antes/despues: 32/28.
- Documentos eliminados/consolidados: 0.
- Codigo muerto confirmado pendiente: 0.
- Duplicaciones eliminadas: CSV runtime vs seed SharePoint.
- Build antes/despues: 10.719.087 bytes / 10.658.698 bytes.
- Objetos DB removidos mediante forward migration: 0.
- Guardian antes/despues: 0 errores, 0 warnings / 0 errores, 0 warnings.
- KEEP_UNCERTAIN: 1.

## Lotes ejecutados

1. Dependencias directas y artifact ZIP: se removieron `react-is`, `@tanstack/query-core`, `pdf-parse` y `artifacts/EEES_ENTERPRISE_FINAL.zip`.
2. Scripts y assets legacy: se removieron 5 scripts ad hoc/one-off y 15 PNG sin referencias.
3. Catalogos muertos: se removio `src/shared/services/catalogs.ts`, 3 CSV duplicados y `ModulePlaceholderPage`.
4. Guardian: se agrego `audit:repository-cleanup` y regla `REL-005`.

## Evidencia final requerida

- Guardian Full: PASS.
- Unit Tests: PASS.
- Contract Tests: PASS.
- Coverage: PASS.
- Migrations: PASS.
- Security: PASS.
- Route/Role: PASS.
- Performance: PASS.
- Operational Readiness: PASS.
- Release Readiness: PASS.
- TypeScript: PASS.
- Build: PASS.
- Affected Smokes: PASS.
- EEES Consistency: PASS.
- `git diff --check`: PASS.

## Cierre

No quedan candidatos `REMOVE_CONFIRMED` ni `CONSOLIDATE` seguros pendientes. Los elementos conservados por incertidumbre o contrato dinamico se registran en `eees/audits/REPOSITORY-CLEANUP-INVENTORY.md`.

## Actualizacion 2026-08-04

- `node_modules` se reconstruyo desde `package-lock.json`: 200 carpetas conflictivas vacias antes, 0 despues; `npm ls --depth=0` queda consistente.
- Se retiraron de forma recuperable 10 MB de builds, cobertura, caches y metadatos locales, mas seis copias conflictivas internas de Git.
- Se redujeron 242 lineas netas de `src`: ocho APIs sin consumidores y dos implementaciones duplicadas consolidadas, sin eliminar ningun modulo frontend completo.
- PostCSS quedo en 8.5.25 y `npm audit` bajo de 3 a 2 vulnerabilidades moderadas; las dos restantes pertenecen a React Router y exigen migracion mayor a v7.
- El auditor de limpieza ahora detecta copias numericas nuevas bajo `node_modules` y `.git/info`.
- Se conservaron por contrato los dos logos identicos, los assets runtime, los documentos EEES unicos, las migraciones forward-only y los seeds historicos sujetos a revision de privacidad.
- La instalacion activa se aloja fuera del arbol sincronizado de `Documents` y `node_modules` es un enlace local ignorado; esto evita que macOS rehidrate nuevamente copias conflictivas, preservando la resolucion Node al mantener un directorio padre real con hijo `node_modules`.
