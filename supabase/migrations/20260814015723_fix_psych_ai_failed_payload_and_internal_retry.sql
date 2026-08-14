set check_function_bodies = on;

create or replace function public.get_psycholaboral_result_detail(p_assessment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  payload jsonb;
begin
  if uid is null or not public.user_can_access_psycholaboral(uid) then
    raise exception 'Sin permisos para Gestión Psicolaboral';
  end if;

  select jsonb_build_object(
    'assessment_id', a.id,
    'candidate', jsonb_build_object(
      'full_name', cp.full_name,
      'national_id', cp.national_id,
      'job_position_name', rc.job_position_name,
      'contract_name', rc.contract_name
    ),
    'execution_status', a.execution_status,
    'decision', a.decision,
    'completed_at', a.completed_at,
    'certificate_status', a.certificate_status,
    'certificate_available', a.certificate_status = 'generated',
    'ai_status', a.ai_status,
    'ai_interpretation', case when latest_ai.id is null then null else jsonb_build_object(
      'id', latest_ai.id,
      'status', latest_ai.status,
      'provider', latest_ai.provider,
      'model', latest_ai.model,
      'display_output', case
        when latest_ai.status in ('PENDING_REVIEW','REVIEWED','VALIDATED','OBSERVED')
        then coalesce(latest_ai.reviewed_output, latest_ai.original_output)
        else null
      end,
      'error_message', case
        when latest_ai.status = 'FAILED'
        then coalesce(latest_ai.last_error, latest_run.error_message, 'Interpretación IA fallida; se reintentará automáticamente.')
        else null
      end,
      'validation_flags', latest_ai.validation_flags,
      'guardrail_flags', latest_ai.guardrail_flags,
      'reviewer_comment', latest_ai.reviewer_comment,
      'reviewed_at', latest_ai.reviewed_at,
      'generated_at', latest_ai.generated_at
    ) end,
    'instruments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', v.instrument_code,
        'name', v.name,
        'result', case when v.instrument_code = 'IPIP_IPC_32'
          then ai.result || jsonb_build_object('labor_profile', private.psycholaboral_ipc_profile(ai.result))
          else ai.result
        end,
        'response_count', private.jsonb_object_size(ai.responses),
        'quality', private.psychometric_response_quality(ai.responses, v.response_options),
        'response_distribution', (
          select jsonb_object_agg(distribution.value, distribution.response_count)
          from (
            select response.value, count(*) as response_count
            from jsonb_each_text(ai.responses) response
            group by response.value
          ) distribution
        )
      ) order by ai.sort_order)
      from private.psychometric_assessment_instruments ai
      join private.psychometric_instrument_versions v on v.id = ai.instrument_version_id
      where ai.assessment_id = a.id
    ), '[]'::jsonb)
  )
  into payload
  from private.psychometric_assessments a
  join public.recruitment_case_candidates rcc on rcc.id = a.recruitment_case_candidate_id
  join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
  join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  left join lateral (
    select *
    from private.psych_ai_interpretations i
    where i.assessment_id = a.id
    order by i.created_at desc
    limit 1
  ) latest_ai on true
  left join lateral (
    select r.error_message
    from private.psych_ai_runs r
    where r.interpretation_id = latest_ai.id
    order by r.started_at desc
    limit 1
  ) latest_run on true
  where a.id = p_assessment_id;

  if payload is null then
    raise exception 'Evaluación no encontrada';
  end if;

  return payload;
end;
$$;

revoke all on function public.get_psycholaboral_result_detail(uuid) from public, anon;
grant execute on function public.get_psycholaboral_result_detail(uuid) to authenticated;

notify pgrst, 'reload schema';
