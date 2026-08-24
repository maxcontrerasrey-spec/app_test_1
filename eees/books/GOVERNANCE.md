---
document_id: EEES-BOOK-GOV
title: Governance Book
version: 2.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-08-24
---

# Governance Book

## ENG-001 - Codigo generado sin confianza privilegiada

El codigo generado se revisa con los mismos gates, permisos y contratos que el codigo escrito manualmente.

## ENG-002 - Contratos vivos antes de mutar

Antes de una mutacion productiva se inspeccionan schema, callers, permisos, payloads y estado vivo; no se infieren campos ni resultados.

## GOV-001 - Registro canonico de reglas

`eees/guardian/rules.json` es la fuente canonica. El dominio se deriva del prefijo, el Book de `source_document`, el owner de su metadata y el enforcement de `automatable`/`blocking`. `audit:eees-governance` rechaza IDs duplicados o invalidos, fuentes inexistentes y gates sin reglas.

## GOV-002 - Vigencia de certificacion

La certificacion vigente se materializa en `.eees/evidence/latest.json` y `.eees/evidence/certification.json`. Un reporte historico no certifica `HEAD`. Los estados son `CERTIFIED`, `CERTIFIED_WITH_ACCEPTED_RISK`, `STALE` y `NOT_CERTIFIED`.

`npm run eees:status` compara automaticamente version, antiguedad y SHA de la evidencia con `HEAD`.

## GOV-003 - Excepciones con expiracion

Cada excepcion declara regla, owner, motivo, riesgo, alcance, creacion, expiracion y criterio de salida. Una excepcion vencida bloquea el gate.

## GOV-004 - Reduccion de deuda

Los baselines son limites transitorios, no autorizaciones permanentes. Todo aumento nuevo se reporta; las excepciones tienen vencimiento y criterio de salida. Las reducciones se conservan al actualizar el baseline con evidencia.
