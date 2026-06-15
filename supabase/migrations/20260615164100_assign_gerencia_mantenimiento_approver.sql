-- Migration to assign Rodrigo Galdames as approver for Gerencia de Mantenimiento (40106)
-- Resolves the P0001 error when creating hiring requests for this cost center.

insert into public.cost_center_approvers (
  cost_center_code,
  cost_center_name,
  approver_user_id,
  approver_name,
  approver_email,
  is_active
)
select 
  '40106',
  'GERENCIA MANTENIMIENTO',
  id,
  'Rodrigo Galdames',
  'rodrigo.galdames@busesjm.com',
  true
from public.profiles 
where email = 'rodrigo.galdames@busesjm.com'
on conflict (cost_center_code) do update set
  approver_user_id = excluded.approver_user_id,
  approver_name = excluded.approver_name,
  approver_email = excluded.approver_email,
  is_active = excluded.is_active;
