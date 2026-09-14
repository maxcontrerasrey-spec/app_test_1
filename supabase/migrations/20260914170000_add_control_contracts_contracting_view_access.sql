-- EEES-DB-005: approved
-- owner: Engineering and Human Resources
-- rollback: forward-only; adjust access through a subsequent audited migration.
-- This migration is additive: it preserves every existing module, feature and capability.

begin;

insert into public.role_module_access (role_code, module_code, can_view)
values
  ('control_contratos', 'control_contrataciones', true)
on conflict (role_code, module_code)
do update set can_view = excluded.can_view;

insert into public.role_feature_access (role_code, feature_code, can_access)
values
  ('control_contratos', 'recruitment_processes_summary', true),
  ('control_contratos', 'recruitment_candidate_control', true),
  ('control_contratos', 'recruitment_personnel_to_hire', true),
  ('control_contratos', 'recruitment_internal_mobility', true)
on conflict (role_code, feature_code)
do update set
  can_access = excluded.can_access,
  updated_at = timezone('utc', now());

notify pgrst, 'reload schema';

commit;
