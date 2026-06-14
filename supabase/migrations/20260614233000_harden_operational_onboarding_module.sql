begin;

create table if not exists public.onboarding_template_activity_log (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_templates (id) on delete cascade,
  template_task_id uuid references public.onboarding_template_tasks (id) on delete set null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  comment text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_onboarding_template_activity_log_template_created
  on public.onboarding_template_activity_log (template_id, created_at desc);

create index if not exists idx_onboarding_template_activity_log_task_created
  on public.onboarding_template_activity_log (template_task_id, created_at desc);

alter table public.onboarding_template_activity_log enable row level security;

drop policy if exists "operational_onboarding_template_activity_log_select" on public.onboarding_template_activity_log;
drop policy if exists "operational_onboarding_template_activity_log_insert" on public.onboarding_template_activity_log;

create policy "operational_onboarding_template_activity_log_select"
on public.onboarding_template_activity_log
for select
to authenticated
using (public.user_can_access_operational_onboarding((select auth.uid())));

create policy "operational_onboarding_template_activity_log_insert"
on public.onboarding_template_activity_log
for insert
to authenticated
with check (public.user_can_access_operational_onboarding((select auth.uid())));

grant select, insert on public.onboarding_template_activity_log to authenticated;

create or replace function public.create_operational_onboarding_template(
  p_name text,
  p_description text default null,
  p_cargo text default null,
  p_area text default null,
  p_contrato text default null,
  p_faena text default null,
  p_division text default null,
  p_centro_costo text default null,
  p_worker_type text default null,
  p_is_active boolean default false,
  p_comment text default null
)
returns public.onboarding_templates
language plpgsql
set search_path = public
as $function$
declare
  current_user_id uuid;
  created_template public.onboarding_templates%rowtype;
  normalized_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Sesión no válida para crear plantillas de onboarding.';
  end if;

  if not public.user_can_access_operational_onboarding(current_user_id) then
    raise exception 'Sin permisos para administrar plantillas de onboarding.';
  end if;

  if normalized_name is null then
    raise exception 'El nombre de la plantilla es obligatorio.';
  end if;

  insert into public.onboarding_templates (
    name,
    description,
    cargo,
    area,
    contrato,
    faena,
    division,
    centro_costo,
    worker_type,
    is_active,
    created_by
  )
  values (
    normalized_name,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_cargo, '')), ''),
    nullif(trim(coalesce(p_area, '')), ''),
    nullif(trim(coalesce(p_contrato, '')), ''),
    nullif(trim(coalesce(p_faena, '')), ''),
    nullif(trim(coalesce(p_division, '')), ''),
    nullif(trim(coalesce(p_centro_costo, '')), ''),
    nullif(trim(coalesce(p_worker_type, '')), ''),
    coalesce(p_is_active, false),
    current_user_id
  )
  returning * into created_template;

  insert into public.onboarding_template_activity_log (
    template_id,
    action,
    new_value,
    comment,
    created_by
  )
  values (
    created_template.id,
    'template_created',
    to_jsonb(created_template),
    nullif(trim(coalesce(p_comment, '')), ''),
    current_user_id
  );

  return created_template;
end;
$function$;

revoke all on function public.create_operational_onboarding_template(text, text, text, text, text, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.create_operational_onboarding_template(text, text, text, text, text, text, text, text, text, boolean, text) to authenticated;

create or replace function public.update_operational_onboarding_template(
  p_template_id uuid,
  p_name text,
  p_description text default null,
  p_cargo text default null,
  p_area text default null,
  p_contrato text default null,
  p_faena text default null,
  p_division text default null,
  p_centro_costo text default null,
  p_worker_type text default null,
  p_is_active boolean default false,
  p_comment text default null
)
returns public.onboarding_templates
language plpgsql
set search_path = public
as $function$
declare
  current_user_id uuid;
  normalized_name text := nullif(trim(coalesce(p_name, '')), '');
  existing_template public.onboarding_templates%rowtype;
  updated_template public.onboarding_templates%rowtype;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Sesión no válida para actualizar plantillas de onboarding.';
  end if;

  if not public.user_can_access_operational_onboarding(current_user_id) then
    raise exception 'Sin permisos para administrar plantillas de onboarding.';
  end if;

  if p_template_id is null then
    raise exception 'La plantilla a actualizar es obligatoria.';
  end if;

  if normalized_name is null then
    raise exception 'El nombre de la plantilla es obligatorio.';
  end if;

  select *
  into existing_template
  from public.onboarding_templates
  where id = p_template_id
  for update;

  if not found then
    raise exception 'La plantilla indicada no existe.';
  end if;

  update public.onboarding_templates
  set
    name = normalized_name,
    description = nullif(trim(coalesce(p_description, '')), ''),
    cargo = nullif(trim(coalesce(p_cargo, '')), ''),
    area = nullif(trim(coalesce(p_area, '')), ''),
    contrato = nullif(trim(coalesce(p_contrato, '')), ''),
    faena = nullif(trim(coalesce(p_faena, '')), ''),
    division = nullif(trim(coalesce(p_division, '')), ''),
    centro_costo = nullif(trim(coalesce(p_centro_costo, '')), ''),
    worker_type = nullif(trim(coalesce(p_worker_type, '')), ''),
    is_active = coalesce(p_is_active, false)
  where id = p_template_id
  returning * into updated_template;

  insert into public.onboarding_template_activity_log (
    template_id,
    action,
    old_value,
    new_value,
    comment,
    created_by
  )
  values (
    updated_template.id,
    'template_updated',
    to_jsonb(existing_template),
    to_jsonb(updated_template),
    nullif(trim(coalesce(p_comment, '')), ''),
    current_user_id
  );

  return updated_template;
end;
$function$;

revoke all on function public.update_operational_onboarding_template(uuid, text, text, text, text, text, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.update_operational_onboarding_template(uuid, text, text, text, text, text, text, text, text, text, boolean, text) to authenticated;

create or replace function public.upsert_operational_onboarding_template_task(
  p_template_id uuid,
  p_task_id uuid default null,
  p_area_responsible text default null,
  p_role_responsible text default null,
  p_task_name text default null,
  p_task_description text default null,
  p_is_required boolean default true,
  p_is_blocking boolean default true,
  p_requires_evidence boolean default false,
  p_evidence_type text default null,
  p_sla_hours integer default 24,
  p_order_index integer default 1,
  p_depends_on_task_id uuid default null,
  p_is_active boolean default true,
  p_comment text default null
)
returns public.onboarding_template_tasks
language plpgsql
set search_path = public
as $function$
declare
  current_user_id uuid;
  normalized_area text := nullif(trim(coalesce(p_area_responsible, '')), '');
  normalized_task_name text := nullif(trim(coalesce(p_task_name, '')), '');
  existing_task public.onboarding_template_tasks%rowtype;
  saved_task public.onboarding_template_tasks%rowtype;
  action_name text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Sesión no válida para administrar tareas de onboarding.';
  end if;

  if not public.user_can_access_operational_onboarding(current_user_id) then
    raise exception 'Sin permisos para administrar tareas de onboarding.';
  end if;

  if p_template_id is null then
    raise exception 'La plantilla de la tarea es obligatoria.';
  end if;

  if normalized_area is null then
    raise exception 'El área responsable es obligatoria.';
  end if;

  if normalized_task_name is null then
    raise exception 'El nombre de la tarea es obligatorio.';
  end if;

  perform 1
  from public.onboarding_templates
  where id = p_template_id;

  if not found then
    raise exception 'La plantilla indicada no existe.';
  end if;

  if p_depends_on_task_id is not null then
    perform 1
    from public.onboarding_template_tasks
    where id = p_depends_on_task_id
      and template_id = p_template_id;

    if not found then
      raise exception 'La dependencia indicada no pertenece a la plantilla seleccionada.';
    end if;
  end if;

  if p_task_id is null then
    insert into public.onboarding_template_tasks (
      template_id,
      area_responsible,
      role_responsible,
      task_name,
      task_description,
      is_required,
      is_blocking,
      requires_evidence,
      evidence_type,
      sla_hours,
      order_index,
      depends_on_task_id,
      is_active
    )
    values (
      p_template_id,
      normalized_area,
      nullif(trim(coalesce(p_role_responsible, '')), ''),
      normalized_task_name,
      nullif(trim(coalesce(p_task_description, '')), ''),
      coalesce(p_is_required, true),
      coalesce(p_is_blocking, true),
      coalesce(p_requires_evidence, false),
      nullif(trim(coalesce(p_evidence_type, '')), ''),
      greatest(coalesce(p_sla_hours, 24), 1),
      greatest(coalesce(p_order_index, 1), 1),
      p_depends_on_task_id,
      coalesce(p_is_active, true)
    )
    returning * into saved_task;

    action_name := 'template_task_created';
  else
    select *
    into existing_task
    from public.onboarding_template_tasks
    where id = p_task_id
      and template_id = p_template_id
    for update;

    if not found then
      raise exception 'La tarea indicada no existe o no pertenece a la plantilla.';
    end if;

    update public.onboarding_template_tasks
    set
      area_responsible = normalized_area,
      role_responsible = nullif(trim(coalesce(p_role_responsible, '')), ''),
      task_name = normalized_task_name,
      task_description = nullif(trim(coalesce(p_task_description, '')), ''),
      is_required = coalesce(p_is_required, true),
      is_blocking = coalesce(p_is_blocking, true),
      requires_evidence = coalesce(p_requires_evidence, false),
      evidence_type = nullif(trim(coalesce(p_evidence_type, '')), ''),
      sla_hours = greatest(coalesce(p_sla_hours, 24), 1),
      order_index = greatest(coalesce(p_order_index, 1), 1),
      depends_on_task_id = p_depends_on_task_id,
      is_active = coalesce(p_is_active, true)
    where id = p_task_id
    returning * into saved_task;

    action_name := 'template_task_updated';
  end if;

  insert into public.onboarding_template_activity_log (
    template_id,
    template_task_id,
    action,
    old_value,
    new_value,
    comment,
    created_by
  )
  values (
    saved_task.template_id,
    saved_task.id,
    action_name,
    case when p_task_id is null then null else to_jsonb(existing_task) end,
    to_jsonb(saved_task),
    nullif(trim(coalesce(p_comment, '')), ''),
    current_user_id
  );

  return saved_task;
end;
$function$;

revoke all on function public.upsert_operational_onboarding_template_task(uuid, uuid, text, text, text, text, boolean, boolean, boolean, text, integer, integer, uuid, boolean, text) from public, anon;
grant execute on function public.upsert_operational_onboarding_template_task(uuid, uuid, text, text, text, text, boolean, boolean, boolean, text, integer, integer, uuid, boolean, text) to authenticated;

create or replace function public.delete_operational_onboarding_template_task(
  p_task_id uuid,
  p_comment text default null
)
returns void
language plpgsql
set search_path = public
as $function$
declare
  current_user_id uuid;
  existing_task public.onboarding_template_tasks%rowtype;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Sesión no válida para eliminar tareas de onboarding.';
  end if;

  if not public.user_can_access_operational_onboarding(current_user_id) then
    raise exception 'Sin permisos para administrar tareas de onboarding.';
  end if;

  if p_task_id is null then
    raise exception 'La tarea a eliminar es obligatoria.';
  end if;

  select *
  into existing_task
  from public.onboarding_template_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'La tarea indicada no existe.';
  end if;

  insert into public.onboarding_template_activity_log (
    template_id,
    template_task_id,
    action,
    old_value,
    comment,
    created_by
  )
  values (
    existing_task.template_id,
    existing_task.id,
    'template_task_deleted',
    to_jsonb(existing_task),
    nullif(trim(coalesce(p_comment, '')), ''),
    current_user_id
  );

  delete from public.onboarding_template_tasks
  where id = existing_task.id;
end;
$function$;

revoke all on function public.delete_operational_onboarding_template_task(uuid, text) from public, anon;
grant execute on function public.delete_operational_onboarding_template_task(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
