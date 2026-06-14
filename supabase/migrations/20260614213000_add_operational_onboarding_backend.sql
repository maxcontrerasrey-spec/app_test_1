begin;

create or replace function public.user_can_access_operational_onboarding(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      public.user_is_admin(target_user_id)
      or public.user_can_access_module(target_user_id, 'alta_operacional_personal')
    );
$function$;

revoke all on function public.user_can_access_operational_onboarding(uuid) from public, anon;
grant execute on function public.user_can_access_operational_onboarding(uuid) to authenticated;

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values (
  'alta_operacional_personal',
  'Alta Operacional de Personal',
  '/alta-operacional-personal',
  'Plantillas, casos y trazabilidad del onboarding operacional post-contratacion.',
  42,
  true
)
on conflict (code) do update
set
  name = excluded.name,
  route = excluded.route,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = timezone('utc', now());

delete from public.role_module_access
where module_code = 'alta_operacional_personal'
  and role_code <> 'admin';

insert into public.role_module_access (role_code, module_code, can_view)
values ('admin', 'alta_operacional_personal', true)
on conflict (role_code, module_code) do update
set can_view = true;

create table if not exists public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cargo text,
  area text,
  contrato text,
  faena text,
  division text,
  centro_costo text,
  worker_type text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.onboarding_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_templates (id) on delete cascade,
  area_responsible text not null,
  role_responsible text,
  task_name text not null,
  task_description text,
  is_required boolean not null default true,
  is_blocking boolean not null default true,
  requires_evidence boolean not null default false,
  evidence_type text,
  sla_hours integer check (sla_hours is null or sla_hours >= 0),
  order_index integer not null default 0,
  depends_on_task_id uuid references public.onboarding_template_tasks (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employee_onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees (id) on delete set null,
  candidate_id uuid references public.candidate_profiles (id) on delete set null,
  hiring_request_id uuid references public.hiring_requests (id) on delete set null,
  template_id uuid not null references public.onboarding_templates (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'waiting_external', 'blocked', 'ready_for_operation', 'cancelled')),
  cargo text,
  contrato text,
  faena text,
  division text,
  centro_costo text,
  target_ready_date date,
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  total_tasks integer not null default 0 check (total_tasks >= 0),
  completed_tasks integer not null default 0 check (completed_tasks >= 0),
  expired_tasks integer not null default 0 check (expired_tasks >= 0),
  blocking_pending_tasks integer not null default 0 check (blocking_pending_tasks >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  closed_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employee_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.employee_onboarding_cases (id) on delete cascade,
  template_task_id uuid references public.onboarding_template_tasks (id) on delete set null,
  area_responsible text not null,
  owner_user_id uuid references public.profiles (id) on delete set null,
  role_responsible text,
  task_name text not null,
  task_description text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'rejected', 'not_applicable', 'expired')),
  is_required boolean not null default true,
  is_blocking boolean not null default true,
  requires_evidence boolean not null default false,
  evidence_type text,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  rejected_at timestamptz,
  rejected_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  close_comment text,
  order_index integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employee_onboarding_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.employee_onboarding_tasks (id) on delete cascade,
  case_id uuid not null references public.employee_onboarding_cases (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_url text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  evidence_type text,
  comment text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employee_onboarding_activity_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.employee_onboarding_cases (id) on delete cascade,
  task_id uuid references public.employee_onboarding_tasks (id) on delete cascade,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  comment text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_onboarding_templates_active_matching
  on public.onboarding_templates (is_active, cargo, area, contrato, faena, division, centro_costo, worker_type);
create index if not exists idx_onboarding_template_tasks_template_order
  on public.onboarding_template_tasks (template_id, order_index);
create index if not exists idx_onboarding_template_tasks_dependency
  on public.onboarding_template_tasks (depends_on_task_id);
create index if not exists idx_employee_onboarding_cases_status_created
  on public.employee_onboarding_cases (status, created_at desc);
create index if not exists idx_employee_onboarding_cases_employee
  on public.employee_onboarding_cases (employee_id, created_at desc);
create index if not exists idx_employee_onboarding_cases_candidate
  on public.employee_onboarding_cases (candidate_id, created_at desc);
create index if not exists idx_employee_onboarding_cases_hiring_request
  on public.employee_onboarding_cases (hiring_request_id, created_at desc);
create index if not exists idx_employee_onboarding_cases_template
  on public.employee_onboarding_cases (template_id);
create index if not exists idx_employee_onboarding_cases_target_ready
  on public.employee_onboarding_cases (target_ready_date);
create index if not exists idx_employee_onboarding_tasks_case_status
  on public.employee_onboarding_tasks (case_id, status);
create index if not exists idx_employee_onboarding_tasks_case_order
  on public.employee_onboarding_tasks (case_id, order_index);
create index if not exists idx_employee_onboarding_tasks_owner_status
  on public.employee_onboarding_tasks (owner_user_id, status);
create index if not exists idx_employee_onboarding_tasks_due_at
  on public.employee_onboarding_tasks (due_at);
create index if not exists idx_employee_onboarding_tasks_template_task
  on public.employee_onboarding_tasks (template_task_id);
create index if not exists idx_employee_onboarding_evidence_case_uploaded
  on public.employee_onboarding_evidence (case_id, uploaded_at desc);
create index if not exists idx_employee_onboarding_evidence_task_uploaded
  on public.employee_onboarding_evidence (task_id, uploaded_at desc);
create index if not exists idx_employee_onboarding_activity_log_case_created
  on public.employee_onboarding_activity_log (case_id, created_at desc);
create index if not exists idx_employee_onboarding_activity_log_task_created
  on public.employee_onboarding_activity_log (task_id, created_at desc);

drop trigger if exists trg_onboarding_templates_set_updated_at on public.onboarding_templates;
create trigger trg_onboarding_templates_set_updated_at
before update on public.onboarding_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_onboarding_template_tasks_set_updated_at on public.onboarding_template_tasks;
create trigger trg_onboarding_template_tasks_set_updated_at
before update on public.onboarding_template_tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_employee_onboarding_cases_set_updated_at on public.employee_onboarding_cases;
create trigger trg_employee_onboarding_cases_set_updated_at
before update on public.employee_onboarding_cases
for each row execute function public.set_updated_at();

drop trigger if exists trg_employee_onboarding_tasks_set_updated_at on public.employee_onboarding_tasks;
create trigger trg_employee_onboarding_tasks_set_updated_at
before update on public.employee_onboarding_tasks
for each row execute function public.set_updated_at();

create or replace function public.refresh_employee_onboarding_case_metrics(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  task_totals record;
begin
  if p_case_id is null then
    return;
  end if;

  select
    count(*)::integer as total_tasks,
    count(*) filter (where status in ('completed', 'not_applicable'))::integer as completed_tasks,
    count(*) filter (where status = 'expired')::integer as expired_tasks,
    count(*) filter (
      where is_blocking
        and status not in ('completed', 'not_applicable')
    )::integer as blocking_pending_tasks
  into task_totals
  from public.employee_onboarding_tasks
  where case_id = p_case_id;

  update public.employee_onboarding_cases
  set
    total_tasks = coalesce(task_totals.total_tasks, 0),
    completed_tasks = coalesce(task_totals.completed_tasks, 0),
    expired_tasks = coalesce(task_totals.expired_tasks, 0),
    blocking_pending_tasks = coalesce(task_totals.blocking_pending_tasks, 0),
    progress_percent = case
      when coalesce(task_totals.total_tasks, 0) = 0 then 0
      else round((coalesce(task_totals.completed_tasks, 0)::numeric / task_totals.total_tasks::numeric) * 100, 2)
    end
  where id = p_case_id;
end;
$function$;

revoke all on function public.refresh_employee_onboarding_case_metrics(uuid) from public, anon;
grant execute on function public.refresh_employee_onboarding_case_metrics(uuid) to authenticated;

create or replace function public.handle_employee_onboarding_task_metrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform public.refresh_employee_onboarding_case_metrics(
    case
      when tg_op = 'DELETE' then old.case_id
      else new.case_id
    end
  );

  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_employee_onboarding_task_metrics on public.employee_onboarding_tasks;
create trigger trg_employee_onboarding_task_metrics
after insert or update or delete on public.employee_onboarding_tasks
for each row execute function public.handle_employee_onboarding_task_metrics();

create or replace function public.log_employee_onboarding_case_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor_user_id uuid;
  normalized_old jsonb;
  normalized_new jsonb;
  activity_action text;
begin
  actor_user_id := coalesce(
    auth.uid(),
    case when tg_op <> 'DELETE' then new.created_by else null end,
    case when tg_op <> 'INSERT' then old.created_by else null end
  );

  if tg_op = 'INSERT' then
    insert into public.employee_onboarding_activity_log (
      case_id,
      action,
      new_value,
      created_by
    )
    values (
      new.id,
      'case_created',
      to_jsonb(new),
      actor_user_id
    );

    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.employee_onboarding_activity_log (
      case_id,
      action,
      old_value,
      created_by
    )
    values (
      old.id,
      'case_deleted',
      to_jsonb(old),
      actor_user_id
    );

    return old;
  end if;

  normalized_old := to_jsonb(old) - 'updated_at';
  normalized_new := to_jsonb(new) - 'updated_at';

  if normalized_old = normalized_new then
    return new;
  end if;

  activity_action := case
    when old.status is distinct from new.status then 'case_status_changed'
    else 'case_updated'
  end;

  insert into public.employee_onboarding_activity_log (
    case_id,
    action,
    old_value,
    new_value,
    created_by
  )
  values (
    new.id,
    activity_action,
    normalized_old,
    normalized_new,
    actor_user_id
  );

  return new;
end;
$function$;

drop trigger if exists trg_employee_onboarding_case_activity on public.employee_onboarding_cases;
create trigger trg_employee_onboarding_case_activity
after insert or update or delete on public.employee_onboarding_cases
for each row execute function public.log_employee_onboarding_case_activity();

create or replace function public.log_employee_onboarding_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor_user_id uuid;
  normalized_old jsonb;
  normalized_new jsonb;
  activity_action text;
begin
  actor_user_id := coalesce(
    auth.uid(),
    case when tg_op <> 'DELETE' then new.completed_by else null end,
    case when tg_op <> 'DELETE' then new.rejected_by else null end,
    case when tg_op <> 'DELETE' then new.owner_user_id else null end,
    case when tg_op <> 'INSERT' then old.completed_by else null end,
    case when tg_op <> 'INSERT' then old.rejected_by else null end,
    case when tg_op <> 'INSERT' then old.owner_user_id else null end
  );

  if tg_op = 'INSERT' then
    insert into public.employee_onboarding_activity_log (
      case_id,
      task_id,
      action,
      new_value,
      created_by
    )
    values (
      new.case_id,
      new.id,
      'task_created',
      to_jsonb(new),
      actor_user_id
    );

    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.employee_onboarding_activity_log (
      case_id,
      task_id,
      action,
      old_value,
      created_by
    )
    values (
      old.case_id,
      old.id,
      'task_deleted',
      to_jsonb(old),
      actor_user_id
    );

    return old;
  end if;

  normalized_old := to_jsonb(old) - 'updated_at';
  normalized_new := to_jsonb(new) - 'updated_at';

  if normalized_old = normalized_new then
    return new;
  end if;

  activity_action := case
    when old.status is distinct from new.status then 'task_status_changed'
    else 'task_updated'
  end;

  insert into public.employee_onboarding_activity_log (
    case_id,
    task_id,
    action,
    old_value,
    new_value,
    created_by
  )
  values (
    new.case_id,
    new.id,
    activity_action,
    normalized_old,
    normalized_new,
    actor_user_id
  );

  return new;
end;
$function$;

drop trigger if exists trg_employee_onboarding_task_activity on public.employee_onboarding_tasks;
create trigger trg_employee_onboarding_task_activity
after insert or update or delete on public.employee_onboarding_tasks
for each row execute function public.log_employee_onboarding_task_activity();

create or replace function public.log_employee_onboarding_evidence_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor_user_id uuid;
begin
  actor_user_id := coalesce(
    auth.uid(),
    case when tg_op <> 'DELETE' then new.uploaded_by else null end,
    case when tg_op <> 'INSERT' then old.uploaded_by else null end
  );

  if tg_op = 'INSERT' then
    insert into public.employee_onboarding_activity_log (
      case_id,
      task_id,
      action,
      new_value,
      created_by
    )
    values (
      new.case_id,
      new.task_id,
      'evidence_uploaded',
      to_jsonb(new),
      actor_user_id
    );

    return new;
  end if;

  insert into public.employee_onboarding_activity_log (
    case_id,
    task_id,
    action,
    old_value,
    created_by
  )
  values (
    old.case_id,
    old.task_id,
    'evidence_deleted',
    to_jsonb(old),
    actor_user_id
  );

  return old;
end;
$function$;

drop trigger if exists trg_employee_onboarding_evidence_activity on public.employee_onboarding_evidence;
create trigger trg_employee_onboarding_evidence_activity
after insert or delete on public.employee_onboarding_evidence
for each row execute function public.log_employee_onboarding_evidence_activity();

alter table public.onboarding_templates enable row level security;
alter table public.onboarding_template_tasks enable row level security;
alter table public.employee_onboarding_cases enable row level security;
alter table public.employee_onboarding_tasks enable row level security;
alter table public.employee_onboarding_evidence enable row level security;
alter table public.employee_onboarding_activity_log enable row level security;

drop policy if exists "operational_onboarding_templates_select" on public.onboarding_templates;
drop policy if exists "operational_onboarding_templates_insert" on public.onboarding_templates;
drop policy if exists "operational_onboarding_templates_update" on public.onboarding_templates;
drop policy if exists "operational_onboarding_templates_delete" on public.onboarding_templates;
create policy "operational_onboarding_templates_select"
on public.onboarding_templates
for select
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_templates_insert"
on public.onboarding_templates
for insert
to authenticated
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_templates_update"
on public.onboarding_templates
for update
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())))
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_templates_delete"
on public.onboarding_templates
for delete
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));

drop policy if exists "operational_onboarding_template_tasks_select" on public.onboarding_template_tasks;
drop policy if exists "operational_onboarding_template_tasks_insert" on public.onboarding_template_tasks;
drop policy if exists "operational_onboarding_template_tasks_update" on public.onboarding_template_tasks;
drop policy if exists "operational_onboarding_template_tasks_delete" on public.onboarding_template_tasks;
create policy "operational_onboarding_template_tasks_select"
on public.onboarding_template_tasks
for select
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_template_tasks_insert"
on public.onboarding_template_tasks
for insert
to authenticated
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_template_tasks_update"
on public.onboarding_template_tasks
for update
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())))
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_template_tasks_delete"
on public.onboarding_template_tasks
for delete
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));

drop policy if exists "operational_onboarding_cases_select" on public.employee_onboarding_cases;
drop policy if exists "operational_onboarding_cases_insert" on public.employee_onboarding_cases;
drop policy if exists "operational_onboarding_cases_update" on public.employee_onboarding_cases;
drop policy if exists "operational_onboarding_cases_delete" on public.employee_onboarding_cases;
create policy "operational_onboarding_cases_select"
on public.employee_onboarding_cases
for select
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_cases_insert"
on public.employee_onboarding_cases
for insert
to authenticated
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_cases_update"
on public.employee_onboarding_cases
for update
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())))
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_cases_delete"
on public.employee_onboarding_cases
for delete
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));

drop policy if exists "operational_onboarding_tasks_select" on public.employee_onboarding_tasks;
drop policy if exists "operational_onboarding_tasks_insert" on public.employee_onboarding_tasks;
drop policy if exists "operational_onboarding_tasks_update" on public.employee_onboarding_tasks;
drop policy if exists "operational_onboarding_tasks_delete" on public.employee_onboarding_tasks;
create policy "operational_onboarding_tasks_select"
on public.employee_onboarding_tasks
for select
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_tasks_insert"
on public.employee_onboarding_tasks
for insert
to authenticated
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_tasks_update"
on public.employee_onboarding_tasks
for update
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())))
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_tasks_delete"
on public.employee_onboarding_tasks
for delete
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));

drop policy if exists "operational_onboarding_evidence_select" on public.employee_onboarding_evidence;
drop policy if exists "operational_onboarding_evidence_insert" on public.employee_onboarding_evidence;
drop policy if exists "operational_onboarding_evidence_update" on public.employee_onboarding_evidence;
drop policy if exists "operational_onboarding_evidence_delete" on public.employee_onboarding_evidence;
create policy "operational_onboarding_evidence_select"
on public.employee_onboarding_evidence
for select
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_evidence_insert"
on public.employee_onboarding_evidence
for insert
to authenticated
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_evidence_update"
on public.employee_onboarding_evidence
for update
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())))
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_evidence_delete"
on public.employee_onboarding_evidence
for delete
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));

drop policy if exists "operational_onboarding_activity_log_select" on public.employee_onboarding_activity_log;
drop policy if exists "operational_onboarding_activity_log_insert" on public.employee_onboarding_activity_log;
drop policy if exists "operational_onboarding_activity_log_update" on public.employee_onboarding_activity_log;
drop policy if exists "operational_onboarding_activity_log_delete" on public.employee_onboarding_activity_log;
create policy "operational_onboarding_activity_log_select"
on public.employee_onboarding_activity_log
for select
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_activity_log_insert"
on public.employee_onboarding_activity_log
for insert
to authenticated
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_activity_log_update"
on public.employee_onboarding_activity_log
for update
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())))
with check (public.user_can_access_operational_onboarding((select auth.uid())));
create policy "operational_onboarding_activity_log_delete"
on public.employee_onboarding_activity_log
for delete
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));

grant select, insert, update, delete on public.onboarding_templates to authenticated;
grant select, insert, update, delete on public.onboarding_template_tasks to authenticated;
grant select, insert, update, delete on public.employee_onboarding_cases to authenticated;
grant select, insert, update, delete on public.employee_onboarding_tasks to authenticated;
grant select, insert, update, delete on public.employee_onboarding_evidence to authenticated;
grant select, insert, update, delete on public.employee_onboarding_activity_log to authenticated;

insert into storage.buckets (id, name, public)
values ('onboarding_evidence', 'onboarding_evidence', false)
on conflict (id) do update
set public = false;

drop policy if exists "operational_onboarding_storage_insert" on storage.objects;
drop policy if exists "operational_onboarding_storage_select" on storage.objects;
drop policy if exists "operational_onboarding_storage_update" on storage.objects;
drop policy if exists "operational_onboarding_storage_delete" on storage.objects;

create policy "operational_onboarding_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'onboarding_evidence'
  and public.user_can_access_operational_onboarding((select auth.uid()))
);

create policy "operational_onboarding_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'onboarding_evidence'
  and public.user_can_access_operational_onboarding((select auth.uid()))
);

create policy "operational_onboarding_storage_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'onboarding_evidence'
  and public.user_can_access_operational_onboarding((select auth.uid()))
)
with check (
  bucket_id = 'onboarding_evidence'
  and public.user_can_access_operational_onboarding((select auth.uid()))
);

create policy "operational_onboarding_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'onboarding_evidence'
  and public.user_can_access_operational_onboarding((select auth.uid()))
);

notify pgrst, 'reload schema';

commit;
