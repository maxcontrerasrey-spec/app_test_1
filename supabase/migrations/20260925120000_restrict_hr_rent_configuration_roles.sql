-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; ampliar nuevamente la función de configuración mediante una migración posterior.

begin;

insert into public.role_module_access (role_code, module_code, can_view)
values ('control_contratos', 'control_estructuras_renta', true)
on conflict (role_code, module_code) do update
set can_view = excluded.can_view;

alter function public.user_can_manage_hr_rent_structures(uuid)
  rename to user_can_manage_hr_rent_structures_before_control_contracts;

revoke all on function public.user_can_manage_hr_rent_structures_before_control_contracts(uuid)
from public, anon, authenticated;

create function public.user_can_manage_hr_rent_structures(actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select actor_id is not null and (
    public.user_is_admin(actor_id)
    or public.user_has_role(actor_id, 'control_contratos')
    or public.user_has_role(actor_id, 'gerencia')
    or public.user_has_role(actor_id, 'director_eje')
    or public.user_has_role(actor_id, 'director_op')
    or public.user_has_role(actor_id, 'gerente_general')
  );
$$;

revoke all on function public.user_can_manage_hr_rent_structures(uuid) from public, anon, authenticated;

create or replace function public.current_user_can_configure_hr_rent_structures()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1
      from public.profiles profile_row
      where profile_row.id = auth.uid()
        and profile_row.is_super_admin = true
    )
    or public.user_has_role(auth.uid(), 'control_contratos')
  );
$$;

revoke all on function public.current_user_can_configure_hr_rent_structures() from public, anon, authenticated;

alter function public.get_hr_rent_structure_control(bigint, bigint)
  rename to get_hr_rent_structure_control_before_config_scope;

revoke all on function public.get_hr_rent_structure_control_before_config_scope(bigint, bigint)
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
begin
  payload := public.get_hr_rent_structure_control_before_config_scope(
    p_contract_id,
    p_job_position_id
  );

  return jsonb_set(
    payload,
    '{can_configure}',
    to_jsonb(public.current_user_can_configure_hr_rent_structures()),
    true
  );
end;
$function$;

revoke all on function public.get_hr_rent_structure_control(bigint, bigint) from public, anon;
grant execute on function public.get_hr_rent_structure_control(bigint, bigint) to authenticated;

alter function public.save_hr_rent_structure_config(
  bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean
)
rename to save_hr_rent_structure_config_before_config_scope;

revoke all on function public.save_hr_rent_structure_config_before_config_scope(
  bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean
)
from public, anon, authenticated;

revoke all on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb)
from public, anon, authenticated;

revoke all on function public.save_hr_rent_structure_config(
  bigint, bigint, integer, jsonb, text, text, text, numeric, text
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
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null
     or not public.current_user_can_configure_hr_rent_structures() then
    raise exception 'Sin permisos para configurar estructuras de renta';
  end if;

  return public.save_hr_rent_structure_config_before_config_scope(
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
