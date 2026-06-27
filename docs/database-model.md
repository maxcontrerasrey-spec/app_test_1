# Modelo de Datos Operacional

## Estado actual

La base esta organizada por dominios y consume PostgreSQL/Supabase como motor unico de autorizacion, trazabilidad y logica transaccional.

## Fundacion de Auth y permisos

Tablas base:

- `public.profiles`: identidad operativa, estado, `is_super_admin`, AUP y datos base.
- `public.app_roles`: catalogo de roles.
- `public.user_roles`: asignacion usuario-rol.
- `public.app_modules`: catalogo de modulos navegables.
- `public.role_module_access`: matriz rol-modulo.
- `public.app_capabilities`: capacidades finas (`candidate_control_access`, `can_approve_who_stage`).
- `public.role_capabilities`: asignacion rol-capability.

Helpers clave:

- `public.user_is_admin(...)`
- `public.user_has_role(...)`
- `public.user_can_access_module(...)`
- `public.get_my_effective_permissions()`

## Reclutamiento

Entidades nucleares:

- `public.hiring_requests`
- `public.hiring_request_approvals`
- `public.recruitment_cases`
- `public.recruitment_case_candidates`
- `public.candidate_stage_approvals`
- `public.candidate_documents` y bucket relacionado
- `public.recruitment_case_assignments`

Auditabilidad:

- `public.hiring_request_audit_log`
- `public.recruitment_case_audit_log`

Funciones operativas relevantes:

- `get_dashboard_home_bundle(...)`
- `get_dashboard_operational_summary()`
- `get_recruitment_control_summary()`
- `user_can_view_hiring_request_process_summary(...)`
- RPCs paginadas de `src/modules/recruitment/services/hiringControl.ts`

## Movilidad interna

Entidades:

- `public.internal_mobility_requests`
- `public.internal_mobility_request_approvals`
- `public.internal_mobility_request_audit_log`

Relaciones:

- consume `recruitment_cases` y `hiring_requests` para reservar/liberar cupos.
- comparte visibilidad operativa con `user_can_view_hiring_request_process_summary(...)`.

## Trabajadores y HR operativo

Entidades base:

- `public.employees`
- vista `public.employees_active_current`

Subdominios:

- Incentivos: `public.hr_incentive_*`
- Jornadas: `public.hr_shift_patterns`, `public.hr_worker_rosters`, `public.hr_roster_exceptions`
- Acreditacion: `public.accreditation_*`

Hardening reciente:

- `20260627153000_harden_dashboard_and_worker_search_enterprise.sql` mueve las busquedas calientes hacia `public.employees` con helpers indexables y `pg_trgm`.

## Alta operacional

Entidades:

- `public.onboarding_templates`
- `public.onboarding_template_tasks`
- `public.employee_onboarding_cases`
- `public.employee_onboarding_tasks`
- `public.employee_onboarding_evidence`
- `public.employee_onboarding_activity_log`

## Observabilidad y seguridad

Tablas de auditoria:

- `public.security_audit_logs`
- `public.employee_onboarding_activity_log`
- logs de dominio ya listados arriba

## Riesgos/modelado pendiente

- No existe aun una tabla global unificada tipo `audit_logs` para todos los dominios; hoy la trazabilidad es federada por modulo.
- El historial de migraciones sigue mezclando naming canonico y legacy; el riesgo esta encapsulado, no eliminado.
- Existen artefactos legacy de onboarding con guards viejos a revisar antes de reactivarlos.
