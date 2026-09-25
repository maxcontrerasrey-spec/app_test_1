-- EEES-DB-005: approved
-- owner: Recruitment / BUK integration
-- rollback: forward-only; restore the previous catalog projection through a later audited migration if required.
-- Rule: hiring requests receive only active BUK role associations for each operational contract.

begin;

create or replace function public.get_hiring_request_catalogs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(auth.uid(), 'solicitud_contrataciones') then
    raise exception 'Sin permisos para consultar catalogos de solicitudes';
  end if;

  return jsonb_build_object(
    'contractCatalog', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', contract_row.id,
          'code', contract_row.code,
          'contractNumber', contract_row.contract_number,
          'contractName', contract_row.buk_area_name,
          'costUnit', contract_row.cost_unit,
          'costUnitName', contract_row.cost_unit_name,
          'costCenterCode', contract_row.cost_center_code,
          'costCenterName', contract_row.cost_center_name,
          'active', true
        )
        order by contract_row.buk_area_name
      )
      from (
        select distinct on (contract_record.id)
          contract_record.id,
          contract_record.code,
          mapping.contract_number,
          mapping.buk_area_name,
          contract_record.cost_unit,
          contract_record.cost_unit_name,
          contract_record.cost_center_code,
          contract_record.cost_center_name
        from public.buk_contract_mappings mapping
        join public.contracts contract_record
          on contract_record.id = mapping.contract_id
         and contract_record.is_active = true
        where mapping.is_operational = true
          and mapping.is_one_to_one = true
          and mapping.contract_id is not null
        order by contract_record.id, mapping.buk_area_name
      ) contract_row
    ), '[]'::jsonb),
    'hiringRoles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', role_row.id,
          'code', role_row.code,
          'name', role_row.name,
          'active', true
        )
        order by role_row.name
      )
      from (
        select distinct position_record.id, position_record.code, position_record.name
        from public.buk_job_position_contract_access access_row
        join public.job_positions position_record
          on position_record.id = access_row.job_position_id
         and position_record.is_active = true
        join public.contracts contract_record
          on contract_record.id = access_row.contract_id
         and contract_record.is_active = true
        where access_row.is_active = true
      ) role_row
    ), '[]'::jsonb),
    'jobPositionContractAccess', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'jobPositionId', access_row.job_position_id,
          'contractId', access_row.contract_id
        )
        order by access_row.contract_id, access_row.job_position_id
      )
      from (
        select distinct access_source.job_position_id, access_source.contract_id
        from public.buk_job_position_contract_access access_source
        join public.job_positions position_record
          on position_record.id = access_source.job_position_id
         and position_record.is_active = true
        join public.contracts contract_record
          on contract_record.id = access_source.contract_id
         and contract_record.is_active = true
        where access_source.is_active = true
      ) access_row
    ), '[]'::jsonb),
    'shiftCatalog', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', shift_record.id,
          'code', shift_record.code,
          'name', shift_record.name,
          'active', true
        )
        order by shift_record.name
      )
      from public.shifts shift_record
      where shift_record.is_active = true
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_hiring_request_catalogs() from public, anon;
grant execute on function public.get_hiring_request_catalogs() to authenticated;

notify pgrst, 'reload schema';

commit;
