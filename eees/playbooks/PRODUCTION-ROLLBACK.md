---
document_id: EEES-PLAYBOOK-PRODUCTION-ROLLBACK
title: Production Rollback
version: 1.0.0
status: Activo
language: es-CL
owner: Operations
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Production Rollback

## Trigger

Un release rompe UI, permisos, RPC, Edge Function, integracion BUK, documentos o datos operativos.

## Diagnostico inicial

- Identificar commit, workflow, ambiente y hora de inicio.
- Revisar `npm run guardian:full`, `npm run build:frontend-check`, smokes y logs de GitHub Actions.
- Clasificar frontera: Frontend, SQL/RPC, RLS/grants, Edge Function, integracion externa o datos.
- Confirmar impacto con smoke read-only o query acotada cuando sea posible.

## Contencion

- Pausar workflows programados si pueden duplicar dano.
- No editar migraciones historicas ni ejecutar SQL manual sin registro versionado.
- No reintentar jobs con efectos externos si no existe idempotencia confirmada.
- Comunicar modulo afectado, usuarios impactados y workaround operacional.

## Recuperacion

- Frontend: `git revert <commit>` o forward-fix acotado y redeploy.
- SQL aplicado: usar migracion correctiva forward-only; no hacer rollback destructivo sobre historia aplicada.
- Edge Function: redeploy de version anterior o corregida, validando env/secrets.
- Integraciones BUK/documentos: reintentar solo jobs clasificados como idempotentes y con snapshots parciales revisados.

## Validacion

- `npm run guardian:full`.
- `npm run test:unit`.
- `npm run test:contracts`.
- `npm run test:coverage`.
- `npm run build`.
- Smokes/audits del dominio afectado.
- `git diff --check`.

## Cierre

- Registrar causa raiz, comando de recuperacion, validaciones y lesson si aplica.
- Actualizar checklist de release si el incidente revela un gate faltante.
