-- EEES-DB-005: approved
-- owner: Recruitment and Psychological Assessment
-- rollback: forward-only; restore the previous summary contract through a new migration if required.
begin;

create or replace function public.get_psycholaboral_status_summary(p_search text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare uid uuid := auth.uid(); q text := lower(trim(coalesce(p_search, ''))); summary jsonb;
begin
  if uid is null or not public.user_can_access_psycholaboral(uid) then raise exception 'Sin permisos para Gestion Psicolaboral'; end if;
  with statuses as (
    select case
      when a.id is null then 'not_sent'
      when a.decision = 'approved' then 'approved'
      when a.execution_status = 'completed' then 'completed'
      when a.execution_status = 'expired' then 'expired'
      when a.delivery_status = 'sent' and a.invite_consumed_at is null and a.invite_expires_at <= timezone('utc', now()) then 'expired'
      else 'sent'
    end display_status
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
    join public.hiring_requests hr on hr.id = rc.hiring_request_id
    join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
    left join lateral (select pa.* from private.psychometric_assessments pa where pa.recruitment_case_candidate_id = rcc.id and not (pa.delivery_status = 'failed' and pa.execution_status = 'cancelled') order by pa.created_at desc limit 1) a on true
    where rc.status not in ('filled', 'closed_unfilled', 'cancelled') and rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
      and (q = '' or lower(concat_ws(' ', cp.full_name, cp.national_id, coalesce(cp.personal_email, cp.email), rc.case_code, hr.folio::text, rc.contract_name, rc.job_position_name)) like '%' || q || '%')
  )
  select jsonb_build_object('not_sent', count(*) filter (where display_status = 'not_sent'), 'sent', count(*) filter (where display_status = 'sent'), 'expired', count(*) filter (where display_status = 'expired'), 'completed', count(*) filter (where display_status = 'completed'), 'approved', count(*) filter (where display_status = 'approved'), 'total', count(*)) into summary from statuses;
  return summary;
end;
$function$;

revoke all on function public.get_psycholaboral_status_summary(text) from public, anon;
grant execute on function public.get_psycholaboral_status_summary(text) to authenticated;
notify pgrst, 'reload schema';
commit;
