begin;

create or replace function public.get_recruitment_precandidates_page(
  p_status text default 'pending',
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_status text := coalesce(nullif(trim(p_status), ''), 'pending');
  normalized_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_dsal_precandidate_review_access(current_user_id);

  if normalized_status not in ('pending', 'approved', 'rejected', 'archived', 'all') then
    raise exception 'Estado de precandidato inválido';
  end if;

  with filtered as (
    select rp.*, approved_hr.folio as approved_folio
      from public.recruitment_precandidates rp
      left join public.recruitment_cases approved_rc
        on approved_rc.id = rp.approved_recruitment_case_id
      left join public.hiring_requests approved_hr
        on approved_hr.id = approved_rc.hiring_request_id
     where (normalized_status = 'all' or rp.status = normalized_status)
       and (
         normalized_search is null
         or lower(rp.full_name) like '%' || normalized_search || '%'
         or lower(rp.national_id) like '%' || normalized_search || '%'
         or lower(rp.personal_email) like '%' || normalized_search || '%'
         or lower(rp.phone) like '%' || normalized_search || '%'
         or lower(rp.dsal_role) like '%' || normalized_search || '%'
       )
  ),
  counted as (
    select count(*)::integer as total_count from filtered
  ),
  page_items as (
    select *
      from filtered
     order by submitted_at desc, created_at desc
     limit safe_limit
     offset safe_offset
  ),
  role_counts as (
    select status, dsal_role, count(*)::integer as role_count
      from public.recruitment_precandidates
     group by status, dsal_role
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(page_items) order by page_items.submitted_at desc, page_items.created_at desc), '[]'::jsonb),
    'total_count', (select total_count from counted),
    'summary', jsonb_build_object(
      'pending', (select count(*) from public.recruitment_precandidates where status = 'pending'),
      'approved', (select count(*) from public.recruitment_precandidates where status = 'approved'),
      'rejected', (select count(*) from public.recruitment_precandidates where status = 'rejected'),
      'by_role', jsonb_build_object(
        'pending', coalesce((select jsonb_agg(jsonb_build_object('role', dsal_role, 'count', role_count) order by role_count desc, dsal_role) from role_counts where status = 'pending'), '[]'::jsonb),
        'approved', coalesce((select jsonb_agg(jsonb_build_object('role', dsal_role, 'count', role_count) order by role_count desc, dsal_role) from role_counts where status = 'approved'), '[]'::jsonb),
        'rejected', coalesce((select jsonb_agg(jsonb_build_object('role', dsal_role, 'count', role_count) order by role_count desc, dsal_role) from role_counts where status = 'rejected'), '[]'::jsonb)
      )
    )
  )
    into payload
    from page_items;

  return coalesce(payload, jsonb_build_object(
    'items', '[]'::jsonb,
    'total_count', 0,
    'summary', jsonb_build_object(
      'pending', 0,
      'approved', 0,
      'rejected', 0,
      'by_role', jsonb_build_object('pending', '[]'::jsonb, 'approved', '[]'::jsonb, 'rejected', '[]'::jsonb)
    )
  ));
end;
$function$;

revoke all on function public.get_recruitment_precandidates_page(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_recruitment_precandidates_page(text, text, integer, integer) to authenticated;
notify pgrst, 'reload schema';
commit;
