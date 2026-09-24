# Atlas — Arquitectura del sistema

Status: ACTIVE
Document Type: ACTIVE_ARCHITECTURE
Owner: Engineering
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: src/app, src/modules, supabase y tests
Supersedes: diagramas no fechados
Related Controls: module map, permissions contract, deployment
Change Approval: Engineering

Atlas es una SPA React 18 + TypeScript + Vite. React Router protege rutas, React Query administra cache/invalidation y Supabase concentra Auth, PostgreSQL, RPCs, RLS y Realtime.

La ruta típica es página → hook de dominio → servicio → RPC/tabla → RLS/helpers/triggers → cache y revalidación. Las Edge Functions encapsulan integraciones y procesos fuera del hot path.

Los dominios activos incluyen reclutamiento, movilidad interna, Psych, RRHH/Incentivos, Jornadas, acreditación, certificación, operaciones, BI y alta operacional. BUK sigue siendo fuente de verdad de trabajadores donde el contrato operativo lo define.

Riesgos conocidos: RPCs grandes, deuda legacy de onboarding, ausencia de harness E2E completo por rol y migraciones históricas legacy controladas por baseline.
