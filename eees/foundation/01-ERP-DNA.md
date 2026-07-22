---
document_id: EEES-FOUNDATION-01
title: ERP DNA
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# ERP DNA

## Evidencia del repositorio

- SPA `React 18 + TypeScript + Vite`.
- Router protegido por modulos en `src/app/router/AppRouter.tsx`.
- Dominios en `src/modules/*`.
- Supabase como gateway unico en `src/shared/lib/supabase.ts`.
- Permisos efectivos desde `get_my_effective_permissions()`.
- SQL versionado en `supabase/migrations`.
- Edge Functions para BUK, documentos, certificados, ORION y correo.

## Fronteras canonicas

- UI: paginas, componentes, hooks, query keys y servicios de dominio.
- Backend: RPCs, RLS, grants, triggers y funciones `security definer`.
- Integraciones: scripts programados, Edge Functions y colas transaccionales.
- Gobierno: `docs/`, `tasks/`, `eees/` y Guardian.
