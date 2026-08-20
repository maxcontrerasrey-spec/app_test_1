begin;

create or replace function public.normalize_recruitment_search_text(p_value text)
returns text
language sql
immutable
set search_path = public
as $function$
  select case
    when trim(coalesce(p_value, '')) ~* '^[0-9]{1,3}(\.[0-9]{3})+-[0-9k]$'
      then regexp_replace(upper(trim(p_value)), '[^0-9K]', '', 'g')
    else trim(
      regexp_replace(
        translate(
          lower(coalesce(p_value, '')),
          'áàäâãéèëêíìïîóòöôõúùüûñç',
          'aaaaaeeeeiiiiooooouuuunc'
        ),
        '\s+',
        ' ',
        'g'
      )
    )
  end;
$function$;

drop function if exists public.find_candidate_profile_with_history_by_rut(text);
create function public.find_candidate_profile_with_history_by_rut(
  p_national_id text
)
returns table (
  id uuid,
  national_id text,
  full_name text,
  email text,
  phone text,
  historical_rejections jsonb,
  case_memberships jsonb
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  profile_rec public.candidate_profiles%rowtype;
  normalized_national_id text := regexp_replace(upper(trim(coalesce(p_national_id, ''))), '[^0-9K]', '', 'g');
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select cp.* into profile_rec
    from public.candidate_profiles cp
   where regexp_replace(upper(trim(coalesce(cp.national_id, ''))), '[^0-9K]', '', 'g') = normalized_national_id
   limit 1;

  if profile_rec.id is null then
    return;
  end if;

  return query
  select
    profile_rec.id,
    profile_rec.national_id,
    profile_rec.full_name,
    profile_rec.email,
    profile_rec.phone,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'case_code', rc.case_code,
            'job_position', rc.job_position_name,
            'stage_code', rcc.stage_code,
            'rejection_reason', coalesce(rcc.rejection_reason, rcc.withdrawal_reason),
            'date', coalesce(rcc.updated_at, rcc.created_at)
          ) order by coalesce(rcc.updated_at, rcc.created_at) desc
        )
        from public.recruitment_case_candidates rcc
        join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
        where rcc.candidate_profile_id = profile_rec.id
          and rcc.stage_code in ('rejected', 'withdrawn')
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'case_code', rc.case_code,
            'contract_name', rc.contract_name,
            'job_position', rc.job_position_name,
            'stage_code', rcc.stage_code,
            'case_status', rc.status,
            'date', coalesce(rcc.updated_at, rcc.created_at)
          ) order by coalesce(rcc.updated_at, rcc.created_at) desc
        )
        from public.recruitment_case_candidates rcc
        join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
        where rcc.candidate_profile_id = profile_rec.id
      ),
      '[]'::jsonb
    );
end;
$function$;

revoke all on function public.find_candidate_profile_with_history_by_rut(text) from public, anon;
grant execute on function public.find_candidate_profile_with_history_by_rut(text) to authenticated;

notify pgrst, 'reload schema';

commit;
