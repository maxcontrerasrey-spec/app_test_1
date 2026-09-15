-- EEES-DB-005: approved
-- owner: Engineering and Human Resources
-- rollback: forward-only; restore worker-membership scoping through a later audited migration if required.

begin;

create or replace function private.hr_incentive_contract_is_buk_operational(
  p_contract_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.buk_contract_mappings bcm
    join public.contracts c
      on c.id = bcm.contract_id
     and c.is_active = true
    where c.code = trim(coalesce(p_contract_code, ''))
      and bcm.is_operational = true
      and bcm.is_one_to_one = true
      and bcm.contract_id is not null
  );
$function$;

create or replace function private.assert_hr_incentive_worker_contract(
  p_buk_employee_id text,
  p_contract_code text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if nullif(trim(coalesce(p_buk_employee_id, '')), '') is null then
    raise exception 'Debe seleccionar un trabajador BUK válido';
  end if;

  if not private.hr_incentive_contract_is_buk_operational(p_contract_code) then
    raise exception
      'El contrato seleccionado no está activo y homologado con BUK. Corrige el catálogo contractual antes de registrar el incentivo.';
  end if;
end;
$function$;

create or replace function public.hr_incentive_worker_context_impl(
  p_buk_employee_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  context_payload jsonb;
  primary_contract_code text;
  buk_contract_options jsonb;
begin
  context_payload := public.hr_incentive_worker_context_unscoped_impl(p_buk_employee_id);
  primary_contract_code := nullif(trim(context_payload -> 'worker' ->> 'primary_contract_code'), '');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'contract_code', option_row.contract_code,
        'area_name', option_row.area_name,
        'area_code', null,
        'label', concat_ws(' · ', option_row.contract_code, option_row.area_name),
        'is_primary', option_row.contract_code = primary_contract_code
      )
      order by
        (option_row.contract_code = primary_contract_code) desc,
        option_row.area_name,
        option_row.contract_code
    ),
    '[]'::jsonb
  )
  into buk_contract_options
  from (
    select distinct on (c.code)
      c.code as contract_code,
      coalesce(nullif(trim(bcm.buk_area_name), ''), c.contract_name) as area_name
    from public.buk_contract_mappings bcm
    join public.contracts c
      on c.id = bcm.contract_id
     and c.is_active = true
    where bcm.is_operational = true
      and bcm.is_one_to_one = true
      and bcm.contract_id is not null
    order by c.code, bcm.updated_at desc nulls last, bcm.id desc
  ) option_row;

  return jsonb_set(context_payload, '{available_areas}', buk_contract_options, true);
end;
$function$;

revoke all on function private.hr_incentive_contract_is_buk_operational(text)
  from public, anon, authenticated;
revoke all on function private.assert_hr_incentive_worker_contract(text, text)
  from public, anon, authenticated;
revoke all on function public.hr_incentive_worker_context_impl(text)
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
