-- EEES-DB-005: approved
-- owner: Explicit user request to configure operating days on Atlas service bases.
-- rollback: Restore the previous save RPC, drop the constraint, and drop operating_days after any created service rows have been reconciled.
-- Structured operating weekdays for each Atlas service base (ISO-8601: Monday=1).
begin;

alter table public.atlas_ops_service_templates
  add column operating_days smallint[] not null default '{}'::smallint[];

alter table public.atlas_ops_service_templates
  add constraint atlas_ops_service_templates_operating_days_valid
  check (
    cardinality(operating_days) between 1 and 7
    and operating_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    and array_position(operating_days, null::smallint) is null
  );

create or replace function public.atlas_ops_save_service_template(p_payload jsonb)
returns bigint language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  contract_key bigint := (p_payload->>'contract_id')::bigint;
  template_id bigint;
  operating_days smallint[];
begin
  if actor is null or not public.atlas_ops_can_edit_contract(actor, contract_key) then
    raise exception 'Sin permiso de edición para el contrato.';
  end if;

  if jsonb_typeof(p_payload->'operating_days') is distinct from 'array'
     or jsonb_array_length(p_payload->'operating_days') not between 1 and 7 then
    raise exception 'Selecciona entre uno y siete días de operación.';
  end if;

  select array_agg(day_value order by day_value)
    into operating_days
    from (
      select value::smallint as day_value
      from jsonb_array_elements_text(p_payload->'operating_days') as item(value)
    ) days;

  if exists (select 1 from unnest(operating_days) as days(day_value) where day_value not between 1 and 7)
     or cardinality(operating_days) <> (select count(distinct days.day_value) from unnest(operating_days) as days(day_value)) then
    raise exception 'Los días de operación deben ser únicos y corresponder a lunes-domingo.';
  end if;

  insert into public.atlas_ops_service_templates(
    contract_id, name, provider_name, service_type, contractual_name,
    contractual_category, schedule_label, operating_days
  )
  values (
    contract_key, trim(p_payload->>'name'), nullif(trim(p_payload->>'provider_name'), ''),
    trim(p_payload->>'service_type'), nullif(trim(p_payload->>'contractual_name'), ''),
    nullif(trim(p_payload->>'contractual_category'), ''), nullif(trim(p_payload->>'schedule_label'), ''),
    operating_days
  )
  returning id into template_id;
  return template_id;
end;
$function$;

revoke all on function public.atlas_ops_save_service_template(jsonb) from public, anon;
grant execute on function public.atlas_ops_save_service_template(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
