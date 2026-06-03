begin;

create or replace view public.employees_active_current
with (security_invoker = true) as
with ranked_employees as (
  select
    e.*,
    row_number() over (
      partition by coalesce(nullif(trim(e.document_type), ''), 'buk')
        || ':'
        || coalesce(
          nullif(regexp_replace(coalesce(e.document_number, ''), '\D', '', 'g'), ''),
          e.buk_employee_id
        )
      order by
        case when e.is_active then 0 else 1 end,
        e.updated_at desc nulls last,
        e.created_at desc nulls last,
        e.buk_employee_id desc
    ) as identity_rank
  from public.employees e
)
select
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
  raw_payload,
  created_at,
  updated_at
from ranked_employees
where is_active = true
  and identity_rank = 1;

grant select on public.employees_active_current to authenticated;

notify pgrst, 'reload schema';

commit;
