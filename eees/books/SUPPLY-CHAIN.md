---
document_id: EEES-BOOK-SUP
title: Supply Chain Book
version: 2.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-08-24
---

# Supply Chain Book

## SUP-001 - Vulnerabilidades de dependencias

`npm audit --omit=dev --audit-level=high` bloquea vulnerabilidades `high` o `critical` de produccion. Una aceptacion requiere excepcion EEES vigente.

## SUP-002 - Revision de cambios

Los cambios de `package.json` y `package-lock.json` se revisan juntos. La revision identifica cambios directos, upgrades major, uso y riesgo; no prohibe dependencias nuevas.

## SUP-003 - Estado reproducible

El package manager canonico es npm, el lockfile es `package-lock.json` y CI instala con `npm ci`. Lockfiles alternativos no se aceptan.

## SUP-004 - Higiene de CI

Los workflows usan permisos minimos, no usan `pull_request_target` y referencian actions con SHA o version estable explicita.

## SUP-005 - SBOM

CI genera un CycloneDX SBOM para el build auditado y lo conserva junto con la evidencia EEES.

## SUP-006 - Provenance

`NOT_APPLICABLE`: el repositorio despliega una aplicacion web mediante infraestructura externa y no publica hoy un paquete firmado propio. Se conserva commit, workflow y SBOM como trazabilidad hasta que exista un flujo de release con attestation soportada.
