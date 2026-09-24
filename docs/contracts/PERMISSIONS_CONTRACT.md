# Atlas — Contrato de permisos

Status: ACTIVE
Document Type: ACTIVE_CONTRACT
Owner: Security Engineering
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: get_my_effective_permissions(), helpers, RLS, grants y tests
Supersedes: matrices visuales sin validación backend
Related Controls: ACCESS_CONTROL_POLICY, route-role smoke
Change Approval: Security Engineering

El resultado efectivo combina profile, roles, módulos accesibles, capabilities y super-admin. El cliente solo expresa visibilidad; cada mutación sensible vuelve a validar autorización en SQL.

Roles y módulos documentados en docs/permissions-matrix.md son referencia técnica. La equivalencia antes/después debe demostrarse por usuario/rol y no inferirse de la navegación.

Contrato de no regresión: esta normalización no modificó perfiles, roles, módulos, capabilities, helpers, RLS, grants ni políticas.
