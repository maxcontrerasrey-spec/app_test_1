begin;

-- ============================================================
-- FIX: "candidate_profile_id is ambiguous" en add_candidate_to_recruitment_case
--
-- Causa raíz: `returns table (candidate_profile_id uuid)` crea una
-- variable PL/pgSQL que colisiona con la columna de tabla homónima
-- en las cláusulas ON CONFLICT y WHERE.
--
-- Solución: renombrar las columnas de salida a out_* para evitar
-- colisiones con nombres de columnas reales.
-- ============================================================

drop function if exists public.add_candidate_to_recruitment_case(uuid, text, text, text, text);

create or replace function public.add_candidate_to_recruitment_case(
  p_case_id uuid,
  p_national_id text,
  p_full_name text,
  p_email text default null,
  p_phone text default null
)
returns table (
  out_case_candidate_id uuid,
  out_candidate_profile_id uuid
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  case_record public.recruitment_cases%rowtype;
  profile_id uuid;
  created_case_candidate_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  if not public.user_can_manage_recruitment_case(current_user_id, p_case_id) then
    raise exception 'Sin permisos para actualizar este caso';
  end if;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = p_case_id
   for update;

  if case_record.id is null then
    raise exception 'No existe el caso indicado';
  end if;

  if case_record.status in ('filled', 'closed_unfilled', 'cancelled') then
    raise exception 'El caso ya no acepta candidatos nuevos';
  end if;

  if nullif(trim(coalesce(p_national_id, '')), '') is null then
    raise exception 'El identificador del candidato es obligatorio';
  end if;

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'El nombre del candidato es obligatorio';
  end if;

  insert into public.candidate_profiles (
    national_id,
    full_name,
    email,
    phone
  )
  values (
    trim(p_national_id),
    trim(p_full_name),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), '')
  )
  on conflict (national_id) do update
  set
    full_name = excluded.full_name,
    email = coalesce(excluded.email, public.candidate_profiles.email),
    phone = coalesce(excluded.phone, public.candidate_profiles.phone),
    updated_at = timezone('utc', now())
  returning id into profile_id;

  insert into public.recruitment_case_candidates (
    recruitment_case_id,
    candidate_profile_id,
    stage_code,
    stage_entered_at,
    suitability_status,
    is_selected,
    created_by
  )
  values (
    p_case_id,
    profile_id,
    'lead',
    timezone('utc', now()),
    'unknown',
    false,
    current_user_id
  )
  on conflict (recruitment_case_id, candidate_profile_id) do nothing
  returning id into created_case_candidate_id;

  if created_case_candidate_id is null then
    select rcc.id
      into created_case_candidate_id
      from public.recruitment_case_candidates rcc
     where rcc.recruitment_case_id = p_case_id
       and rcc.candidate_profile_id = profile_id;
  else
    insert into public.recruitment_case_candidate_stage_history (
      recruitment_case_candidate_id,
      from_stage,
      to_stage,
      changed_by,
      reason_code,
      comment
    )
    values (
      created_case_candidate_id,
      null,
      'lead',
      current_user_id,
      'candidate_added',
      null
    );

    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      recruitment_case_candidate_id,
      actor_user_id,
      action_type,
      new_values,
      metadata
    )
    values (
      p_case_id,
      created_case_candidate_id,
      current_user_id,
      'candidate_added',
      jsonb_build_object(
        'candidate_profile_id', profile_id,
        'stage_code', 'lead'
      ),
      jsonb_build_object(
        'national_id', trim(p_national_id),
        'full_name', trim(p_full_name)
      )
    );
  end if;

  perform public.sync_recruitment_case_status(p_case_id, current_user_id);

  return query
  select created_case_candidate_id, profile_id;
end;
$function$;

revoke all on function public.add_candidate_to_recruitment_case(uuid, text, text, text, text) from public, anon;
grant execute on function public.add_candidate_to_recruitment_case(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
