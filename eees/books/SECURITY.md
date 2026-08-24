---
document_id: EEES-BOOK-SEC
title: Security Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Security Book

## ERR-001 - Errores UI sanitizados

La UI traduce fallos tecnicos mediante el helper canonico y no expone stack, SQL ni secretos.

## AI-001 - IA administrada y gobernada

Los flujos de IA respetan autorizacion backend, minimizacion de datos, trazabilidad y configuracion administrada.

## SEC-005 - Secret scanning

Todo archivo versionado y todo archivo local no ignorado se evalua con `audit:secrets`; asi el control local cubre secretos antes del primer commit. Los hallazgos solo informan tipo y ruta, nunca el valor. Binarios, outputs y lockfile se excluyen para reducir falsos positivos.

## SEC-006 - SECURITY DEFINER hardening

Toda RPC `SECURITY DEFINER` debe justificar el privilegio, fijar `search_path`, validar identidad y autorizacion, y declarar grants minimos. La auditoria se aplica a migraciones forward-only y no reescribe historia aplicada.

## SEC-007 - Pruebas negativas de autorizacion

Las fronteras sensibles deben probar tanto el acceso permitido como el rechazo a roles no autorizados, lectura de terceros, suplantacion de IDs y mutaciones fuera de alcance.

## Proposito

Definir reglas normativas para security book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **SEC-001. Service role fuera del navegador.** Service role solo se permite en scripts controlados, CI o Edge Functions.
- **SEC-002. Autorizacion backend autoritativa.** Las acciones criticas deben validar actor en SQL/RPC, no depender de UI.
- **SEC-003. Sin permisos por email.** Roles, modulos y capabilities viven en SQL y `access.ts`, no en allowlists locales por correo.
- **SEC-004. Errores sanitizados.** Errores hacia UI no deben exponer stacks ni secretos.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
