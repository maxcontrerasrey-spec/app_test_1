-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; restore the prior rent profile RPCs with a later migration.

begin;

alter table public.hr_rent_structures
  add column legal_regime_code text;

alter table public.hr_rent_structures
  add constraint hr_rent_structures_legal_regime_code_check
  check (legal_regime_code is null or legal_regime_code in ('art_25', 'ordinario'));

create table public.hr_rent_structure_shifts (
  structure_id uuid not null references public.hr_rent_structures(id) on delete cascade,
  shift_id bigint not null references public.shifts(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (structure_id, shift_id)
);

create index hr_rent_structure_shifts_shift_id_idx
  on public.hr_rent_structure_shifts (shift_id);

alter table public.hr_rent_structure_shifts enable row level security;
revoke all on table public.hr_rent_structure_shifts from public, anon, authenticated;

alter function public.get_hr_rent_structure_control(bigint, bigint)
  rename to get_hr_rent_structure_control_before_shift_regime;

revoke all on function public.get_hr_rent_structure_control_before_shift_regime(bigint, bigint)
  from public, anon, authenticated;

create function public.get_hr_rent_structure_control(
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
  shift_catalog jsonb := '[]'::jsonb;
  v_structure_id uuid;
  selected_shift_ids jsonb := '[]'::jsonb;
  regime_code text;
begin
  payload := public.get_hr_rent_structure_control_before_shift_regime(
    p_contract_id, p_job_position_id
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', shift_row.id,
    'code', shift_row.code,
    'name', shift_row.name
  ) order by shift_row.name), '[]'::jsonb)
  into shift_catalog
  from public.shifts shift_row
  where shift_row.is_active = true;

  if p_contract_id is not null and p_job_position_id is not null then
    begin
      v_structure_id := nullif(payload #>> '{structure,id}', '')::uuid;
    exception when invalid_text_representation then
      v_structure_id := null;
    end;

    if v_structure_id is not null then
      select coalesce(jsonb_agg(link.shift_id order by shift_row.name) filter (where link.shift_id is not null), '[]'::jsonb),
        max(structure_row.legal_regime_code)
      into selected_shift_ids, regime_code
      from public.hr_rent_structures structure_row
      left join public.hr_rent_structure_shifts link on link.structure_id = structure_row.id
      left join public.shifts shift_row on shift_row.id = link.shift_id
      where structure_row.id = v_structure_id;

      payload := jsonb_set(payload, '{structure,shift_ids}', selected_shift_ids, true);
      payload := jsonb_set(payload, '{structure,legal_regime_code}', to_jsonb(regime_code), true);
      payload := jsonb_set(payload, '{structure,shift_classification_pending}', to_jsonb(jsonb_array_length(selected_shift_ids) = 0 or regime_code is null), true);
    end if;
  end if;

  return jsonb_set(payload, '{shift_catalog}', shift_catalog, true);
end;
$function$;

revoke all on function public.get_hr_rent_structure_control(bigint, bigint) from public, anon;
grant execute on function public.get_hr_rent_structure_control(bigint, bigint) to authenticated;

create function public.save_hr_rent_structure_config(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_authorized_headcount integer,
  p_lines jsonb,
  p_afp_code text,
  p_health_mode text,
  p_health_provider_name text,
  p_health_plan_value numeric,
  p_unemployment_contract_type text,
  p_include_income_tax boolean,
  p_shift_ids bigint[],
  p_legal_regime_code text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_structure_id uuid;
  requested_count integer;
  active_count integer;
begin
  if auth.uid() is null or not public.current_user_can_configure_hr_rent_structures() then
    raise exception 'Sin permisos para configurar estructuras de renta';
  end if;
  if p_legal_regime_code is null or p_legal_regime_code not in ('art_25', 'ordinario') then
    raise exception 'Selecciona un régimen legal válido';
  end if;
  if coalesce(cardinality(p_shift_ids), 0) = 0 then
    raise exception 'Selecciona al menos una jornada aplicable';
  end if;

  select count(distinct shift_id)::integer into requested_count
  from unnest(p_shift_ids) as requested(shift_id);
  select count(*)::integer into active_count
  from public.shifts shift_row
  where shift_row.id = any(p_shift_ids) and shift_row.is_active = true;
  if requested_count <> cardinality(p_shift_ids) or active_count <> requested_count then
    raise exception 'Una o más jornadas seleccionadas no están activas en el catálogo';
  end if;

  v_structure_id := public.save_hr_rent_structure_config(
    p_contract_id, p_job_position_id, p_authorized_headcount, p_lines, p_afp_code,
    p_health_mode, p_health_provider_name, p_health_plan_value,
    p_unemployment_contract_type, p_include_income_tax
  );

  update public.hr_rent_structures
  set legal_regime_code = p_legal_regime_code,
      updated_at = timezone('utc', now())
  where id = v_structure_id;

  delete from public.hr_rent_structure_shifts where hr_rent_structure_shifts.structure_id = v_structure_id;
  insert into public.hr_rent_structure_shifts (structure_id, shift_id)
  select v_structure_id, requested.shift_id
  from unnest(p_shift_ids) as requested(shift_id);

  return v_structure_id;
end;
$function$;

revoke all on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean, bigint[], text) from public, anon;
grant execute on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean, bigint[], text) to authenticated;

notify pgrst, 'reload schema';

commit;
