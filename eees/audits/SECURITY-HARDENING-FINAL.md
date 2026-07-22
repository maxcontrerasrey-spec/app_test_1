---
document_id: EEES-AUDIT-SECURITY-HARDENING-FINAL
title: Security Hardening Final
version: 1.0.0
status: Activo
language: es-CL
owner: Security
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Security Hardening Final

## Resultado

Sin blockers internos P0/P1 identificados en la superficie ejecutable del repo.

## Superficies revisadas

- RLS y grants: auditados por `npm run audit:supabase-security`.
- SECURITY DEFINER/search_path: cubierto por auditor Supabase con baseline historico.
- Service role: restringido a scripts controlados, CI y Edge Functions; Guardian bloquea uso en `src`.
- Auth boundaries: rutas protegidas por `RouteProtectedRoute`, `RoleProtectedRoute` y matriz de permisos.
- IDOR/auth.uid(): funciones criticas recientes validan actor en SQL/RPC o Edge Function antes de mutar.
- Storage policies: documentos operativos son privados por defecto; validacion publica usa Edge Function acotada.
- Signed URLs/rutas publicas: certificados exponen snapshot minimo y no rutas internas de Storage/BUK.
- Secrets: nombres versionados, valores fuera del repo.
- Logs: errores HTML/proveedor se sanitizan antes de UI; snapshots internos quedan controlados.
- CORS/validation Edge: funciones criticas validan auth o secreto interno antes de efectos externos.
- Admin overrides: gestionados por roles/capabilities, no por email hardcodeado en frontend.

## Evidencia

- `npm run audit:supabase-security`.
- `npm run audit:route-role-smoke`.
- `npm run audit:frontend-auth-smoke-matrix`.
- `npm run guardian:full`.

## Riesgo residual

Smokes autenticados con cuentas reales y metricas hosted dependen de secrets externos; se clasifican en `eees/audits/FINAL-RESIDUAL-RISK-REGISTER.md`.
