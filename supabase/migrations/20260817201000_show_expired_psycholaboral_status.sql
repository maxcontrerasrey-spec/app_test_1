begin;

create or replace function public.get_psycholaboral_candidates_page(
  p_search text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  lim int := least(greatest(coalesce(p_limit,50),1),100);
  offv int := greatest(coalesce(p_offset,0),0);
  q text := lower(trim(coalesce(p_search,'')));
  items jsonb;
  total bigint;
begin
  if uid is null or not public.user_can_access_psycholaboral(uid) then
    raise exception 'Sin permisos para Gestion Psicolaboral';
  end if;

  with base as (
    select
      rcc.id,
      cp.full_name,
      cp.national_id,
      coalesce(nullif(lower(trim(cp.personal_email)),''),nullif(lower(trim(cp.email)),'')) email,
      rc.case_code,
      hr.folio,
      rc.contract_name,
      rc.job_position_name,
      rc.status case_status,
      rcc.stage_code,
      rcc.stage_entered_at,
      a.id assessment_id,
      a.delivery_status,
      a.execution_status,
      a.decision,
      a.created_at assessment_created_at,
      a.issued_at,
      a.started_at,
      a.deadline_at,
      a.completed_at,
      a.certificate_status,
      a.certificate_path,
      a.report_status,
      a.ai_status,
      a.ai_updated_at,
      latest_ai.id ai_interpretation_id,
      latest_ai.status ai_interpretation_status,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', v.instrument_code,
          'name', v.short_name,
          'status', ai.status,
          'answered', private.jsonb_object_size(ai.responses),
          'total', jsonb_array_length(v.questions)
        ) order by ai.sort_order)
        from private.psychometric_assessment_instruments ai
        join private.psychometric_instrument_versions v on v.id = ai.instrument_version_id
        where ai.assessment_id = a.id
      ), '[]'::jsonb) instruments
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
    join public.hiring_requests hr on hr.id = rc.hiring_request_id
    join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
    left join lateral (
      select pa.*
      from private.psychometric_assessments pa
      where pa.recruitment_case_candidate_id = rcc.id
        and not (pa.delivery_status = 'failed' and pa.execution_status = 'cancelled')
      order by pa.created_at desc
      limit 1
    ) a on true
    left join lateral (
      select i.id, i.status
      from private.psych_ai_interpretations i
      where i.assessment_id = a.id
      order by i.created_at desc
      limit 1
    ) latest_ai on true
    where rc.status not in ('filled','closed_unfilled','cancelled')
      and rcc.stage_code not in ('hired','rejected','withdrawn')
  ),
  filtered as (
    select *,
      case when assessment_id is null then 'not_sent'
           when execution_status = 'completed' then 'completed'
           when execution_status = 'expired' then 'expired'
           else 'sent'
      end display_status
    from base
    where q = ''
       or lower(concat_ws(' ', full_name, national_id, email, case_code, folio::text, contract_name, job_position_name)) like '%' || q || '%'
  ),
  selected as (
    select *
    from filtered
    where nullif(trim(coalesce(p_status,'')), '') is null
       or display_status = p_status
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.assessment_created_at desc nulls last, p.full_name), '[]'::jsonb),
         (select count(*) from selected)
  into items, total
  from (
    select *
    from selected
    order by assessment_created_at desc nulls last, full_name
    limit lim offset offv
  ) p;

  return jsonb_build_object('items', coalesce(items, '[]'::jsonb), 'total_count', coalesce(total, 0));
end;
$function$;

revoke all on function public.get_psycholaboral_candidates_page(text, text, integer, integer) from public, anon;
grant execute on function public.get_psycholaboral_candidates_page(text, text, integer, integer) to authenticated;

notify pgrst, 'reload schema';

commit;
