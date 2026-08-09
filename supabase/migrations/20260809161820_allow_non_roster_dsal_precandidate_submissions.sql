-- Los RUT que no aparecen en la nomina vigente tambien pueden postular.
-- La nomina solo actua como autocompletado autoritativo cuando existe coincidencia.
create or replace function public.submit_dsal_precandidate_application(
  p_national_id text,
  p_first_name text,
  p_last_name text,
  p_second_last_name text,
  p_address_line text,
  p_region text,
  p_current_city text,
  p_driver_license_classes text[],
  p_dsal_role text,
  p_phone text,
  p_personal_email text,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  allowed_licenses constant text[] := array['A1 (Ley 18.290)', 'A2', 'A3', 'B'];
  normalized_national_id text := public.normalize_dsal_precandidate_rut(p_national_id);
  normalized_first_name text := public.normalize_dsal_precandidate_name(p_first_name);
  normalized_last_name text := public.normalize_dsal_precandidate_name(p_last_name);
  normalized_second_last_name text := public.normalize_dsal_precandidate_name(p_second_last_name);
  normalized_address_line text := public.normalize_dsal_precandidate_name(p_address_line);
  normalized_region text := public.normalize_dsal_precandidate_text(p_region);
  normalized_current_city text := public.normalize_dsal_precandidate_name(p_current_city);
  normalized_phone text := public.normalize_dsal_precandidate_phone(p_phone);
  normalized_personal_email text := lower(public.normalize_dsal_precandidate_text(p_personal_email));
  normalized_comments text := public.normalize_dsal_precandidate_name(p_comments);
  normalized_licenses text[];
  invalid_licenses text[];
  saved_id uuid;
  roster_record public.recruitment_dsal_roster%rowtype;
  roster_match boolean := false;
begin
  if not public.is_valid_dsal_precandidate_rut(normalized_national_id) then
    raise exception 'El RUT ingresado no es válido';
  end if;

  select *
    into roster_record
    from public.recruitment_dsal_roster
   where national_id = normalized_national_id
     and is_active = true;

  roster_match := roster_record.national_id is not null;

  if roster_match then
    normalized_first_name := roster_record.first_name;
    normalized_last_name := roster_record.last_name;
    normalized_second_last_name := roster_record.second_last_name;
  end if;

  if normalized_first_name is null
    or normalized_last_name is null
    or normalized_second_last_name is null
    or normalized_address_line is null
    or normalized_region is null
    or normalized_current_city is null
    or normalized_personal_email is null then
    raise exception 'Completa todos los campos obligatorios';
  end if;

  if normalized_phone is null or normalized_phone !~ '^\+569[0-9]{8}$' then
    raise exception 'El teléfono debe contener 8 dígitos después del prefijo +56 9';
  end if;

  if not public.is_valid_dsal_precandidate_email(normalized_personal_email) then
    raise exception 'El email personal no tiene un formato válido';
  end if;

  if p_dsal_role not in ('Interno Mina', 'Furgón Eléctrico', 'Bus Eléctrico', 'Ciudades Base') then
    raise exception 'Selecciona un rol DSAL válido';
  end if;

  select coalesce(array_agg(distinct license order by license), '{}'::text[])
    into normalized_licenses
    from unnest(coalesce(p_driver_license_classes, '{}'::text[])) as license
   where nullif(trim(license), '') is not null;

  if cardinality(normalized_licenses) = 0 then
    raise exception 'Selecciona al menos una licencia de conducir';
  end if;

  select coalesce(array_agg(license), '{}'::text[])
    into invalid_licenses
    from unnest(normalized_licenses) as license
   where license <> all(allowed_licenses);

  if cardinality(invalid_licenses) > 0 then
    raise exception 'La postulación contiene licencias no permitidas';
  end if;

  if exists (
    select 1
      from public.recruitment_precandidates
     where national_id = normalized_national_id
  ) then
    raise exception 'Este RUT ya registra una postulación y no puede volver a enviarse';
  end if;

  begin
    insert into public.recruitment_precandidates (
      national_id,
      first_name,
      last_name,
      second_last_name,
      full_name,
      address_line,
      region,
      current_city,
      driver_license_classes,
      dsal_role,
      phone,
      personal_email,
      comments,
      metadata
    )
    values (
      normalized_national_id,
      normalized_first_name,
      normalized_last_name,
      normalized_second_last_name,
      concat_ws(' ', normalized_first_name, normalized_last_name, normalized_second_last_name),
      normalized_address_line,
      normalized_region,
      normalized_current_city,
      normalized_licenses,
      p_dsal_role,
      normalized_phone,
      normalized_personal_email,
      normalized_comments,
      jsonb_build_object(
        'source', 'public_dsal_application',
        'roster_match', roster_match,
        'roster_source', case when roster_match then roster_record.source_name else null end
      )
    )
    returning id into saved_id;
  exception
    when unique_violation then
      raise exception 'Este RUT ya registra una postulación y no puede volver a enviarse';
  end;

  return jsonb_build_object(
    'id', saved_id,
    'status', 'received',
    'roster_match', roster_match
  );
end;
$function$;

revoke all on function public.submit_dsal_precandidate_application(
  text, text, text, text, text, text, text, text[], text, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_dsal_precandidate_application(
  text, text, text, text, text, text, text, text[], text, text, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
