---
document_id: EEES-AUDIT-2-POST-IMPLEMENTATION
title: Auditoria post implementacion EEES 2.0
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-08-24
---

# Auditoria post implementacion EEES 2.0

## Alcance

Revision adversarial de gobernanza, certificacion, migraciones, secretos, supply chain, CI, Supabase, SBOM y performance sobre `main`. Se preservaron los cambios locales concurrentes de BUK.

## Hallazgos corregidos

1. El guard destructivo comparaba un checkout limpio contra `HEAD` y no inspeccionaba migraciones comprometidas. Ahora usa el SHA base/head del evento, exige historial Git y bloquea CI sin rango valido.
2. El workflow tenia filtros parciales y podia omitir cambios funcionales. Ahora corre en todo push a `main` y en todo pull request.
3. La certificacion se emitia antes del build y de los controles finales. Ahora se genera y verifica al final, con hash de evidencia y SBOM asociado.
4. `STALE` retornaba codigo exitoso. Solo `CERTIFIED` y `CERTIFIED_WITH_ACCEPTED_RISK` son estados de salida validos.
5. Cualquier warning se rotulaba como riesgo aceptado. Las observaciones quedan separadas y solo una excepcion vigente produce ese estado.
6. El scanner de secretos no cubria archivos locales nuevos ni formatos modernos. Ahora incluye archivos no ignorados, amplía patrones y nunca imprime valores.
7. Actions externas usaban tags mutables e inputs se interpolaban en shell. Las referencias quedaron fijadas a SHA y los inputs pasan por variables validadas.
8. El baseline Supabase permitia compensar un warning nuevo con otro eliminado. Ahora el conjunto historico se protege por cantidad y SHA-256 de fingerprints.
9. Performance dependia de tolerancias implicitas. El presupuesto exacto queda declarado en el baseline y todo aumento requiere actualizacion versionada.
10. Los controles anteriores carecian de pruebas adversariales. Se agregaron fixtures para rango Git limpio, SQL destructivo, secretos, excepciones, gates y orden de CI.

## Riesgos residuales

- Los 82 warnings historicos Supabase permanecen visibles y congelados por fingerprint; reducirlos requiere migraciones forward-only y validacion productiva, no reescritura de historia.
- La inspeccion estatica de `SECURITY DEFINER` complementa, pero no reemplaza, una auditoria periodica del catalogo productivo `pg_proc`, grants y `search_path`.
- La cobertura global no equivale a diff coverage para toda la aplicacion; la matriz critica existente sigue siendo el control minimo hasta incorporar cobertura por cambio.

## Criterio de cierre

El cambio se considera cerrado cuando pruebas focalizadas, Guardian completo, build, CI remoto y evidencia final para el commit publicado terminen correctamente.
