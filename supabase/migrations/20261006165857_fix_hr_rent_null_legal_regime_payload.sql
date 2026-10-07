-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; keep returning JSON null for unclassified legacy regimes.

begin;

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
      -- SQL NULL would make jsonb_set return SQL NULL and erase the entire RPC payload.
      -- Preserve an explicit JSON null for legacy structures awaiting classification.
      payload := jsonb_set(payload, '{structure,legal_regime_code}', coalesce(to_jsonb(regime_code), 'null'::jsonb), true);
      payload := jsonb_set(payload, '{structure,shift_classification_pending}', to_jsonb(jsonb_array_length(selected_shift_ids) = 0 or regime_code is null), true);
    end if;
  end if;

  return jsonb_set(payload, '{shift_catalog}', shift_catalog, true);
end;
$function$;

revoke all on function public.get_hr_rent_structure_control(bigint, bigint) from public, anon;
grant execute on function public.get_hr_rent_structure_control(bigint, bigint) to authenticated;
notify pgrst, 'reload schema';

commit;
