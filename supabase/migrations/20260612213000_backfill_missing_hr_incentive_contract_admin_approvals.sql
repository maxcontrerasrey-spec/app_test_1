begin;

with pending_requests_without_approvals as (
  select
    hir.id as request_id,
    hir.created_by,
    hir.selected_contract_code,
    approver.contract_admin_user_id,
    approver.contract_admin_name,
    approver.contract_admin_email
  from public.hr_incentive_requests hir
  join lateral public.resolve_hr_incentive_contract_approvers(hir.selected_contract_code) as approver
    on true
  where hir.status = 'P'
    and not exists (
      select 1
      from public.hr_incentive_request_approvals hira
      where hira.incentive_request_id = hir.id
    )
),
inserted_approvals as (
  insert into public.hr_incentive_request_approvals (
    incentive_request_id,
    step_code,
    step_name,
    step_order,
    approver_user_id,
    approver_name,
    approver_email,
    status,
    created_at,
    updated_at
  )
  select
    source.request_id,
    'contract_admin',
    'Administrador de contrato',
    1,
    source.contract_admin_user_id,
    source.contract_admin_name,
    source.contract_admin_email,
    'pending',
    timezone('utc', now()),
    timezone('utc', now())
  from pending_requests_without_approvals as source
  returning incentive_request_id, approver_user_id, approver_name, approver_email
)
insert into public.hr_incentive_request_history (
  incentive_request_id,
  action_type,
  actor_user_id,
  metadata
)
select
  source.request_id,
  'approval_created',
  source.created_by,
  jsonb_build_object(
    'step_code', 'contract_admin',
    'step_name', 'Administrador de contrato',
    'approver_user_id', source.contract_admin_user_id,
    'approver_name', source.contract_admin_name,
    'approver_email', source.contract_admin_email,
    'status', 'pending',
    'repair_reason', 'backfill_missing_initial_approval'
  )
from pending_requests_without_approvals as source
join inserted_approvals as inserted
  on inserted.incentive_request_id = source.request_id;

notify pgrst, 'reload schema';

commit;
