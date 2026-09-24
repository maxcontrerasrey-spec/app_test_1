# Atlas — Política de control de acceso

Status: ACTIVE
Document Type: ACTIVE_POLICY
Owner: Security Engineering
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: get_my_effective_permissions(), helpers user_can_*, RLS, grants y tests
Supersedes: allowlists de frontend y matrices no verificadas
Related Controls: PERMISSIONS_CONTRACT, RLS, route-role smoke, security audit
Change Approval: Security Engineering + dueño del módulo

## Regla de autorización

El frontend filtra navegación, pero la autoridad real es PostgreSQL/Supabase mediante identidad, helpers, RLS, grants y RPCs. service_role no sustituye la identidad del usuario en flujos interactivos.

## Preservación

No se fusionan, renombran, revocan ni amplían roles sin matriz antes/después, tests contractuales y evidencia productiva. La normalización actual no cambió permisos efectivos de admin, reclutamiento, control_contratos, operaciones, gerencia, certificaciones, instructores ni otros roles productivos.

## Evidencia mínima

Antes de una modificación se capturan perfiles, roles, módulos, capabilities, RLS, grants y smoke tests por rol. Si no puede demostrarse equivalencia, el cambio no se aplica.

## Superficies críticas

Se mantienen bajo control backend las rutas de reclutamiento, Psych, RRHH, Jornadas, acreditación, certificación, operaciones, BI y alta operacional. La visibilidad no concede mutación.
