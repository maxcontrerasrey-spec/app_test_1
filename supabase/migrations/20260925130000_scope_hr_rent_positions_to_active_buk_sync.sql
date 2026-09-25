-- EEES-DB-005: approved
-- owner: Recursos Humanos / Integracion BUK
-- rollback: forward-only; restaurar el catalogo desacoplado mediante una migracion posterior.

begin;

alter function public.get_hr_rent_structure_control(bigint, bigint)
  rename to get_hr_rent_structure_control_before_buk_active_scope;

revoke all on function public.get_hr_rent_structure_control_before_buk_active_scope(bigint, bigint)
from public, anon, authenticated;

create or replace function public.get_hr_rent_structure_control(
  p_contract_id bigint default null,
  p_job_position_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  payload jsonb;
  active_contracts jsonb := '[]'::jsonb;
  active_positions jsonb := '[]'::jsonb;
  selected_position_is_active boolean := false;
begin
  payload := public.get_hr_rent_structure_control_before_buk_active_scope(
    p_contract_id,
    p_job_position_id
  );

  select coalesce(jsonb_agg(contract_item order by contract_ordinality), '[]'::jsonb)
  into active_contracts
  from jsonb_array_elements(coalesce(payload -> 'contracts', '[]'::jsonb))
    with ordinality as contract_catalog(contract_item, contract_ordinality)
  where exists (
    select 1
    from public.hr_rent_contract_positions relation_row
    join public.buk_job_position_contract_access access_row
      on access_row.contract_id = relation_row.contract_id
     and access_row.job_position_id = relation_row.job_position_id
     and access_row.is_active = true
    join public.job_positions position_row
      on position_row.id = relation_row.job_position_id
     and position_row.is_active = true
    where relation_row.contract_id = (contract_item ->> 'id')::bigint
      and relation_row.is_active = true
  );

  if p_contract_id is not null then
    select coalesce(jsonb_agg(position_item order by position_ordinality), '[]'::jsonb)
    into active_positions
    from jsonb_array_elements(coalesce(payload -> 'positions', '[]'::jsonb))
      with ordinality as position_catalog(position_item, position_ordinality)
    where exists (
      select 1
      from public.hr_rent_contract_positions relation_row
      join public.buk_job_position_contract_access access_row
        on access_row.contract_id = relation_row.contract_id
       and access_row.job_position_id = relation_row.job_position_id
       and access_row.is_active = true
      join public.job_positions position_row
        on position_row.id = relation_row.job_position_id
       and position_row.is_active = true
      where relation_row.contract_id = p_contract_id
        and relation_row.job_position_id = (position_item ->> 'id')::bigint
        and relation_row.is_active = true
    );
  end if;

  if p_contract_id is not null and p_job_position_id is not null then
    select exists (
      select 1
      from public.hr_rent_contract_positions relation_row
      join public.buk_job_position_contract_access access_row
        on access_row.contract_id = relation_row.contract_id
       and access_row.job_position_id = relation_row.job_position_id
       and access_row.is_active = true
      join public.job_positions position_row
        on position_row.id = relation_row.job_position_id
       and position_row.is_active = true
      where relation_row.contract_id = p_contract_id
        and relation_row.job_position_id = p_job_position_id
        and relation_row.is_active = true
    ) into selected_position_is_active;
  end if;

  payload := jsonb_set(payload, '{contracts}', active_contracts, true);
  payload := jsonb_set(payload, '{positions}', active_positions, true);

  if p_job_position_id is not null and not selected_position_is_active then
    payload := jsonb_set(payload, '{structure}', '{}'::jsonb, true);
  end if;

  return payload;
end;
$function$;

revoke all on function public.get_hr_rent_structure_control(bigint, bigint) from public, anon;
grant execute on function public.get_hr_rent_structure_control(bigint, bigint) to authenticated;

alter function public.save_hr_rent_structure_config(
  bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean
)
rename to save_hr_rent_structure_config_before_buk_active_scope;

revoke all on function public.save_hr_rent_structure_config_before_buk_active_scope(
  bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean
)
from public, anon, authenticated;

create or replace function public.save_hr_rent_structure_config(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_authorized_headcount integer,
  p_lines jsonb,
  p_afp_code text,
  p_health_mode text,
  p_health_provider_name text,
  p_health_plan_value numeric,
  p_unemployment_contract_type text,
  p_include_income_tax boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not exists (
    select 1
    from public.hr_rent_contract_positions relation_row
    join public.buk_job_position_contract_access access_row
      on access_row.contract_id = relation_row.contract_id
     and access_row.job_position_id = relation_row.job_position_id
     and access_row.is_active = true
    join public.job_positions position_row
      on position_row.id = relation_row.job_position_id
     and position_row.is_active = true
    where relation_row.contract_id = p_contract_id
      and relation_row.job_position_id = p_job_position_id
      and relation_row.is_active = true
  ) then
    raise exception 'El cargo ya no esta activo en BUK para el contrato seleccionado';
  end if;

  return public.save_hr_rent_structure_config_before_buk_active_scope(
    p_contract_id,
    p_job_position_id,
    p_authorized_headcount,
    p_lines,
    p_afp_code,
    p_health_mode,
    p_health_provider_name,
    p_health_plan_value,
    p_unemployment_contract_type,
    p_include_income_tax
  );
end;
$function$;

revoke all on function public.save_hr_rent_structure_config(
  bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean
)
from public, anon;
grant execute on function public.save_hr_rent_structure_config(
  bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean
)
to authenticated;

notify pgrst, 'reload schema';

commit;
