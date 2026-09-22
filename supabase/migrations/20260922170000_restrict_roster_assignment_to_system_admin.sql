-- EEES-DB-005: approved
-- owner: Plataforma
-- rollback: forward-only; restaurar el acceso de asignación mediante una migración posterior con aprobación explícita.
-- Motivo: gerentes y administradores requieren consulta de Jornadas, pero la asignación de pautas debe quedar exclusiva del administrador del sistema.
begin;

update public.role_feature_access
set can_access = false,
    updated_at = now()
where feature_code = 'roster_assign_pattern'
  and role_code <> 'admin';

commit;
