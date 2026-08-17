begin;

create or replace function public.expire_abandoned_psycholaboral_assessments()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  expired_count integer := 0;
  assessment_id_value uuid;
begin
  if uid is null or not public.user_can_access_psycholaboral(uid) then
    raise exception 'Sin permisos para Gestion Psicolaboral';
  end if;

  for assessment_id_value in
    update private.psychometric_assessments
    set execution_status = 'expired',
        last_error = 'Evaluacion abandonada: vencio el plazo de 90 minutos',
        updated_at = timezone('utc', now())
    where execution_status = 'in_progress'
      and deadline_at is not null
      and deadline_at <= timezone('utc', now())
    returning id
  loop
    expired_count := expired_count + 1;
    insert into private.psychometric_audit_log(assessment_id, event_type, actor_user_id, metadata)
    values (
      assessment_id_value,
      'assessment_expired_by_deadline',
      uid,
      jsonb_build_object('reason', 'deadline_elapsed', 'limit_minutes', 90)
    );
  end loop;

  return expired_count;
end;
$function$;

revoke all on function public.expire_abandoned_psycholaboral_assessments() from public, anon;
grant execute on function public.expire_abandoned_psycholaboral_assessments() to authenticated;

notify pgrst, 'reload schema';

commit;
