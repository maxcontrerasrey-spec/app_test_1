begin;

revoke select on public.employees from authenticated;
revoke select on public.employees_active_current from authenticated;

grant select (
  id,
  buk_employee_id,
  full_name,
  email,
  job_title,
  contract_code,
  area_name,
  area_code,
  document_number,
  document_type,
  birth_date,
  status,
  is_active,
  created_at,
  updated_at
) on public.employees to authenticated;

grant select (
  id,
  buk_employee_id,
  full_name,
  email,
  job_title,
  contract_code,
  area_name,
  area_code,
  document_number,
  document_type,
  birth_date,
  status,
  is_active,
  created_at,
  updated_at
) on public.employees_active_current to authenticated;

notify pgrst, 'reload schema';

commit;
