begin;

with deprecated_widgets as (
  update public.dashboard_widgets dw
     set is_active = false
   where dw.component_key in ('AlertsWidget', 'KPIWidget', 'TimelineWidget')
     and dw.is_active = true
  returning dw.id
)
delete from public.user_dashboard_preferences udp
 using deprecated_widgets dw
 where udp.widget_id = dw.id;

update public.hiring_requests hr
   set requester_name = p.full_name,
       requester_email = p.email,
       updated_at = timezone('utc', now())
  from public.profiles p
 where p.id = coalesce(hr.requester_id, hr.submitted_by)
   and (
     (p.full_name is not null and nullif(trim(p.full_name), '') is not null and hr.requester_name is distinct from p.full_name)
     or (p.email is not null and nullif(trim(p.email), '') is not null and hr.requester_email is distinct from p.email)
   );

with inferred_travel_methodology as (
  select distinct on (hral.hiring_request_id)
    hral.hiring_request_id,
    nullif(trim(hral.metadata->>'travel_methodology'), '') as travel_methodology
  from public.hiring_request_audit_log hral
  where hral.action_type = 'approved'
    and hral.metadata->>'step_code' = 'contracts_control'
    and nullif(trim(hral.metadata->>'travel_methodology'), '') is not null
  order by hral.hiring_request_id, hral.created_at desc
)
update public.hiring_requests hr
   set travel_methodology = inferred.travel_methodology,
       updated_at = timezone('utc', now())
  from inferred_travel_methodology inferred
 where hr.id = inferred.hiring_request_id
   and hr.status = 'approved'
   and coalesce(hr.pasajes, false) = true
   and hr.travel_methodology is null;

create index if not exists idx_hiring_request_approvals_approver_status_created_at
  on public.hiring_request_approvals (approver_user_id, status, created_at);

create index if not exists idx_hiring_request_approvals_request_step_status
  on public.hiring_request_approvals (hiring_request_id, step_code, status);

create index if not exists idx_hiring_requests_status_current_step_folio
  on public.hiring_requests (status, current_step_code, folio);

create index if not exists idx_hiring_request_audit_log_request_created_at
  on public.hiring_request_audit_log (hiring_request_id, created_at desc);

create index if not exists idx_recruitment_cases_hiring_request_id
  on public.recruitment_cases (hiring_request_id);

notify pgrst, 'reload schema';

commit;
