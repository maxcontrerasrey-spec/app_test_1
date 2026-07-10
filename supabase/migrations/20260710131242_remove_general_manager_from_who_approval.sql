begin;

-- WHO deja de escalar a Gerencia General. La cadena queda acotada a admin
-- y Dirección de Operaciones, sin cambiar otros accesos del rol gerente_general.
delete from public.role_capabilities
where role_code = 'gerente_general'
  and capability_code = 'can_approve_who_stage';

create or replace function public.enqueue_who_pending_approval_email(
  p_approval_id bigint,
  p_is_reminder boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  approval_record record;
  recipients jsonb := '[]'::jsonb;
  event_key text;
begin
  select
    csa.id,
    csa.stage_code,
    csa.created_at,
    rcc.id as candidate_id,
    cp.full_name as candidate_name,
    cp.national_id as candidate_rut,
    hr.id as hiring_request_id,
    hr.folio,
    hr.requester_name,
    hr.requester_email,
    hr.job_position_name,
    hr.contract_name
  into approval_record
  from public.candidate_stage_approvals csa
  join public.recruitment_case_candidates rcc
    on rcc.id = csa.recruitment_case_candidate_id
  join public.candidate_profiles cp
    on cp.id = rcc.candidate_profile_id
  join public.recruitment_cases rc
    on rc.id = rcc.recruitment_case_id
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  where csa.id = p_approval_id
    and csa.status = 'pending'
    and csa.stage_code = 'who_pending'
  limit 1;

  if approval_record.id is null then
    return;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'email', who_approvers.email,
        'name', who_approvers.name
      )
      order by who_approvers.name, who_approvers.email
    ),
    '[]'::jsonb
  )
  into recipients
  from (
    select distinct
      lower(trim(p.email)) as email,
      coalesce(nullif(trim(p.full_name), ''), trim(p.email)) as name
    from public.profiles p
    where p.status = 'active'
      and nullif(trim(coalesce(p.email, '')), '') is not null
      and (
        p.is_super_admin = true
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p.id
            and ur.role_code in ('admin', 'director_op')
        )
      )
  ) as who_approvers;

  if recipients = '[]'::jsonb then
    return;
  end if;

  event_key := format(
    'who-approval-pending:%s%s',
    approval_record.id,
    case when p_is_reminder then ':reminder' else '' end
  );

  perform public.queue_transactional_email_notification(
    event_key,
    'who_approval',
    jsonb_build_object(
      'kind', 'who_approval',
      'event_key', event_key,
      'is_reminder', p_is_reminder,
      'to', recipients,
      'approval', jsonb_build_object(
        'id', approval_record.id,
        'stage_code', approval_record.stage_code,
        'created_at', approval_record.created_at
      ),
      'candidate', jsonb_build_object(
        'id', approval_record.candidate_id,
        'full_name', approval_record.candidate_name,
        'rut', approval_record.candidate_rut
      ),
      'request', jsonb_build_object(
        'id', approval_record.hiring_request_id,
        'folio', approval_record.folio,
        'requester_name', approval_record.requester_name,
        'requester_email', approval_record.requester_email,
        'job_position_name', approval_record.job_position_name,
        'contract_name', approval_record.contract_name
      ),
      'route', '/'
    )
  );
end;
$function$;

revoke all on function public.enqueue_who_pending_approval_email(bigint, boolean)
from public, anon, authenticated;

commit;
