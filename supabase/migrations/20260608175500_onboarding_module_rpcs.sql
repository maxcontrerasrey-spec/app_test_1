begin;

-- 1. Iniciar el Onboarding para un empleado y asignarle todos los cursos por defecto de 'Conductor'
create or replace function public.start_employee_onboarding(
  p_employee_id uuid
)
returns table (process_id uuid)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  new_process_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not (public.user_can_access_module(current_user_id, 'reclutamiento') or public.user_is_admin(current_user_id)) then
    raise exception 'Sin permisos para iniciar onboarding';
  end if;

  if exists (select 1 from public.onboarding_processes where employee_id = p_employee_id) then
    raise exception 'El empleado ya tiene un proceso de onboarding iniciado';
  end if;

  insert into public.onboarding_processes (employee_id, status)
  values (p_employee_id, 'in_progress')
  returning id into new_process_id;

  -- Asignar los cursos por defecto para conductor (en el futuro esto puede ser mas granulado)
  insert into public.onboarding_employee_courses (onboarding_process_id, course_id, status)
  select new_process_id, id, 'pending'
  from public.onboarding_courses_catalog
  where is_active = true;

  return query select new_process_id;
end;
$function$;

revoke all on function public.start_employee_onboarding(uuid) from public, anon;
grant execute on function public.start_employee_onboarding(uuid) to authenticated;


-- 2. Dashboard de Onboarding (Listar procesos)
create or replace function public.get_onboarding_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  active_processes jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not (public.user_can_access_module(current_user_id, 'reclutamiento') or public.user_is_admin(current_user_id)) then
    raise exception 'Sin permisos para ver onboarding';
  end if;

  select coalesce(jsonb_agg(row order by row.started_at desc), '[]'::jsonb)
  into active_processes
  from (
    select
      op.id as process_id,
      op.status as process_status,
      op.started_at,
      e.id as employee_id,
      e.full_name as employee_name,
      e.job_title,
      e.area_name,
      e.buk_employee_id,
      (
        select count(*)
        from public.onboarding_employee_courses oec
        where oec.onboarding_process_id = op.id
      ) as total_courses,
      (
        select count(*)
        from public.onboarding_employee_courses oec
        where oec.onboarding_process_id = op.id and oec.status = 'approved'
      ) as approved_courses,
      (
        select count(*)
        from public.onboarding_employee_courses oec
        where oec.onboarding_process_id = op.id and oec.status = 'rejected'
      ) as rejected_courses
    from public.onboarding_processes op
    join public.employees e on e.id = op.employee_id
  ) row;

  return jsonb_build_object(
    'active_processes', active_processes
  );
end;
$function$;

revoke all on function public.get_onboarding_dashboard() from public, anon;
grant execute on function public.get_onboarding_dashboard() to authenticated;


-- 3. Detalle de Onboarding de un Empleado
create or replace function public.get_employee_onboarding_detail(p_process_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  process_detail jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not (public.user_can_access_module(current_user_id, 'reclutamiento') or public.user_is_admin(current_user_id)) then
    raise exception 'Sin permisos para ver onboarding';
  end if;

  select jsonb_build_object(
    'process_id', op.id,
    'status', op.status,
    'employee', jsonb_build_object(
      'id', e.id,
      'full_name', e.full_name,
      'job_title', e.job_title,
      'area_name', e.area_name
    ),
    'courses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', oec.id,
          'course_id', cat.id,
          'course_name', cat.name,
          'category', cat.category,
          'status', oec.status,
          'evaluation_date', oec.evaluation_date,
          'notes', oec.notes,
          'instructor_name', oec.instructor_name
        ) order by cat.category, cat.name
      )
      from public.onboarding_employee_courses oec
      join public.onboarding_courses_catalog cat on cat.id = oec.course_id
      where oec.onboarding_process_id = op.id
    ), '[]'::jsonb)
  )
  into process_detail
  from public.onboarding_processes op
  join public.employees e on e.id = op.employee_id
  where op.id = p_process_id;

  return process_detail;
end;
$function$;

revoke all on function public.get_employee_onboarding_detail(uuid) from public, anon;
grant execute on function public.get_employee_onboarding_detail(uuid) to authenticated;


-- 4. Evaluar un Curso
create or replace function public.evaluate_onboarding_course(
  p_employee_course_id uuid,
  p_status text,
  p_notes text,
  p_instructor_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not (public.user_can_access_module(current_user_id, 'reclutamiento') or public.user_is_admin(current_user_id)) then
    raise exception 'Sin permisos para evaluar cursos';
  end if;

  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Estado de evaluacion invalido';
  end if;

  update public.onboarding_employee_courses
  set status = p_status,
      notes = p_notes,
      instructor_name = p_instructor_name,
      evaluated_by = current_user_id,
      evaluation_date = case when p_status != 'pending' then timezone('utc', now()) else null end
  where id = p_employee_course_id;

  -- Chequear si todos los cursos estan completados para marcar el onboarding como completado
  -- Si no hay pendientes ni rechazados, se marca como completado
  if not exists (
    select 1 
    from public.onboarding_employee_courses 
    where onboarding_process_id = (select onboarding_process_id from public.onboarding_employee_courses where id = p_employee_course_id)
      and status in ('pending', 'rejected')
  ) then
    update public.onboarding_processes
    set status = 'completed',
        completed_at = timezone('utc', now())
    where id = (select onboarding_process_id from public.onboarding_employee_courses where id = p_employee_course_id);
  else
    update public.onboarding_processes
    set status = 'in_progress',
        completed_at = null
    where id = (select onboarding_process_id from public.onboarding_employee_courses where id = p_employee_course_id);
  end if;

end;
$function$;

revoke all on function public.evaluate_onboarding_course(uuid, text, text, text) from public, anon;
grant execute on function public.evaluate_onboarding_course(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
