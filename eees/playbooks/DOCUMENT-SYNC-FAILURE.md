---
document_id: EEES-PLAYBOOK-DOCSYNC
title: Document Sync Failure
version: 1.0.0
status: Activo
language: es-CL
owner: Operations
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Document Sync Failure

## Trigger

Documento no sube a BUK, no se purga o queda inconsistente.

## Impacto

Riesgo documental y operativo para candidato/trabajador.

## Diagnostico

- Revisar commit, workflow, logs locales y comandos fallidos.
- Identificar si la falla es UI, SQL/RPC, RLS, Edge Function, integracion o datos.
- Confirmar alcance con query o smoke read-only cuando sea posible.

## Contencion

- Pausar ejecuciones automaticas si duplican dano.
- Evitar cambios manuales sin registro versionado.
- Comunicar alcance operacional si hay usuarios afectados.

## Recuperacion

- Preferir forward-fix SQL versionado o revert frontend segun frontera.
- Reintentar jobs solo cuando exista idempotencia confirmada.
- Revalidar flujo critico con smoke o auditoria.

## Rollback

- Frontend: `git revert <commit>`.
- SQL aplicado: migracion correctiva nueva.
- Edge Function: redeploy de version corregida.

## Escalamiento

Escalar a owner de dominio y responsable de datos si hay riesgo de permisos, documentos, nomina o integracion BUK.

## Postmortem

Registrar causa raiz, guardrail nuevo o lesson, y backlog con prioridad.
