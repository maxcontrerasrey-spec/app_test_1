-- EEES-DB-005: approved
-- owner: Recursos Humanos / Integracion BUK
-- rollback: verification-only; no persistent business data is mutated.

begin;

do $verification$
declare
  target_position_id bigint;
  verifier_id uuid;
  relation_record record;
  payload jsonb;
  relation_count integer := 0;
begin
  select position_row.id
  into target_position_id
  from public.job_positions position_row
  where position_row.code = 'BUK-ROLE-68'
  limit 1;

  if target_position_id is null then
    raise exception 'No existe el cargo BUK-ROLE-68 para verificar su alcance';
  end if;

  if exists (
    select 1
    from public.buk_job_position_contract_access access_row
    where access_row.job_position_id = target_position_id
      and access_row.is_active = true
  ) then
    raise exception 'BUK-ROLE-68 conserva una habilitacion contrato-cargo activa despues de la sync';
  end if;

  select profile_row.id
  into verifier_id
  from public.profiles profile_row
  where profile_row.is_super_admin = true
  order by profile_row.id
  limit 1;

  if verifier_id is null then
    raise exception 'No existe un superadministrador para verificar el RPC de rentas';
  end if;

  perform set_config('request.jwt.claim.sub', verifier_id::text, true);

  for relation_record in
    select relation_row.contract_id
    from public.hr_rent_contract_positions relation_row
    where relation_row.job_position_id = target_position_id
      and relation_row.is_active = true
  loop
    relation_count := relation_count + 1;
    payload := public.get_hr_rent_structure_control(
      relation_record.contract_id,
      target_position_id
    );

    if exists (
      select 1
      from jsonb_array_elements(coalesce(payload -> 'positions', '[]'::jsonb)) position_item
      where position_item ->> 'code' = 'BUK-ROLE-68'
    ) then
      raise exception 'BUK-ROLE-68 sigue visible en el catalogo del contrato %', relation_record.contract_id;
    end if;

    if coalesce(payload #>> '{structure,id}', '') <> '' then
      raise exception 'BUK-ROLE-68 sigue exponiendo su estructura en el contrato %', relation_record.contract_id;
    end if;
  end loop;

  if relation_count = 0 then
    raise exception 'La relacion historica de BUK-ROLE-68 no estaba disponible para verificar su preservacion';
  end if;
end;
$verification$;

commit;
