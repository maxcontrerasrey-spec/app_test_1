set check_function_bodies = on;

create or replace function public.reset_psycholaboral_certificate_service(p_assessment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.psychometric_assessments
  set certificate_status = 'queued',
      report_status = 'queued',
      certificate_claim_token = null,
      certificate_claimed_at = null,
      updated_at = timezone('utc', now())
  where id = p_assessment_id
    and execution_status = 'completed';

  if not found then
    raise exception 'La evaluación no está disponible para regenerar';
  end if;

  insert into private.psychometric_audit_log(assessment_id, event_type, metadata)
  values(p_assessment_id, 'certificate_regeneration_requested_service', '{}'::jsonb);
end;
$$;

revoke all on function public.reset_psycholaboral_certificate_service(uuid) from public, anon, authenticated;
grant execute on function public.reset_psycholaboral_certificate_service(uuid) to service_role;

notify pgrst, 'reload schema';
