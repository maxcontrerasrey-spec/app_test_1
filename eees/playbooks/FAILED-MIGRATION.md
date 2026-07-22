---
document_id: EEES-PLAYBOOK-MIGRATION
title: Failed Migration
version: 1.0.0
status: Activo
language: es-CL
owner: Operations
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Failed Migration

## Trigger

Supabase dry-run, push o auditoria de migraciones falla.

## Impacto

Schema o funciones pueden quedar desalineadas con frontend.

## Diagnostico

- Revisar commit, workflow, logs locales y comandos fallidos.
- Identificar si la falla es UI, SQL/RPC, RLS, Edge Function, integracion o datos.
- Confirmar alcance con query o smoke read-only cuando sea posible.
- No editar migraciones historicas aplicadas ni renombrar archivos ya versionados para corregir una falla.
- Comparar `supabase/migrations` con `supabase_migrations.schema_migrations` cuando exista sospecha de drift remoto.

## Contencion

- Pausar ejecuciones automaticas si duplican dano.
- Evitar cambios manuales sin registro versionado.
- Comunicar alcance operacional si hay usuarios afectados.

## Recuperacion

- Preferir forward-fix SQL versionado o revert frontend segun frontera.
- Reintentar jobs solo cuando exista idempotencia confirmada.
- Revalidar flujo critico con smoke o auditoria.
- Si una RPC recompilada no aparece en PostgREST, ejecutar `notify pgrst, 'reload schema'` dentro de la migracion correctiva o validar reload equivalente.
- Si una migracion ya fue aplicada manualmente, registrar la version en `supabase_migrations.schema_migrations` solo despues de confirmar que el efecto existe.

## Rollback

- Frontend: `git revert <commit>`.
- SQL aplicado: migracion correctiva nueva.
- Edge Function: redeploy de version corregida.

## Escalamiento

Escalar a owner de dominio y responsable de datos si hay riesgo de permisos, documentos, nomina o integracion BUK.

## Postmortem

Registrar causa raiz, guardrail nuevo o lesson, y backlog con prioridad.
