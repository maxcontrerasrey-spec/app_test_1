begin;

alter table public.hiring_request_approvals
  add column if not exists approver_name text,
  add column if not exists approver_email text;

update public.hiring_request_approvals hra
set
  approver_name = coalesce(
    hra.approver_name,
    p.full_name,
    split_part(p.email, '@', 1)
  ),
  approver_email = coalesce(
    hra.approver_email,
    p.email
  ),
  updated_at = timezone('utc', now())
from public.profiles p
where hra.approver_user_id = p.id
  and (hra.approver_name is null or hra.approver_email is null);

notify pgrst, 'reload schema';

commit;
