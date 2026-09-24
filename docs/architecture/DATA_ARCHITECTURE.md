# Atlas — Arquitectura de datos

Status: ACTIVE
Document Type: ACTIVE_ARCHITECTURE
Owner: Engineering + Data Governance
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: migraciones aplicadas, esquema PostgreSQL, RLS y RPCs
Supersedes: modelos desconectados del esquema real
Related Controls: data protection, audit standard, BUK contract
Change Approval: Engineering + Data Governance

El modelo está organizado por dominios y usa PostgreSQL/Supabase como autoridad transaccional, de autorización y de trazabilidad.

Auth y permisos se apoyan en profiles, app_roles, user_roles, app_modules, role_module_access, app_capabilities y role_capabilities, junto con helpers y get_my_effective_permissions().

Reclutamiento usa hiring_requests, recruitment_cases, candidatos, documentos, aprobaciones y logs. RRHH usa employees, hr_incentive_*, hr_shift_patterns, hr_worker_rosters, hr_roster_exceptions y accreditation_*.

La auditoría es federada por dominio. BUK y snapshots se relacionan mediante identificadores estables y mapeos explícitos; no se debe inventar un segundo maestro de trabajadores.
