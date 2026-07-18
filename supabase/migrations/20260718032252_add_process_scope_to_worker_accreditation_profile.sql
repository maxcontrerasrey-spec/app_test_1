begin;

create or replace function public.get_worker_accreditation_profile(
  p_buk_employee_id text,
  p_site_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  resolved_worker_accreditation_id uuid;
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para consultar el perfil de acreditacion';
  end if;

  resolved_worker_accreditation_id := public.generate_worker_requirements(p_buk_employee_id, p_site_id, false);

  perform public.recalculate_accreditation_status(p_buk_employee_id, p_site_id);

  return (
    with roster_context as (
      select jsonb_build_object(
        'pattern_name', sp.name,
        'pattern_code', sp.code,
        'start_date', wr.start_date,
        'end_date', wr.end_date
      ) as payload
      from public.hr_worker_rosters wr
      join public.hr_shift_patterns sp
        on sp.id = wr.pattern_id
      where wr.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
        and wr.start_date <= current_date
        and (wr.end_date is null or wr.end_date >= current_date)
      order by wr.start_date desc, wr.created_at desc
      limit 1
    ),
    today_exceptions as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'exception_date', hre.exception_date,
            'exception_type', hre.exception_type,
            'notes', hre.notes,
            'is_active', hre.is_active
          )
          order by hre.exception_date desc
        ),
        '[]'::jsonb
      ) as payload
      from public.hr_roster_exceptions hre
      where hre.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
        and hre.is_active = true
        and hre.exception_date between current_date - 7 and current_date + 7
    ),
    document_rows as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'document_tracking_id', wdt.id,
            'requirement_id', ar.id,
            'requirement_code', ar.code,
            'requirement_name', ar.name,
            'category', ar.category,
            'process_scope', ar.process_scope,
            'description', ar.description,
            'is_mandatory', ar.is_mandatory,
            'requires_expiry_date', ar.requires_expiry_date,
            'alert_days_before_expiry', ar.alert_days_before_expiry,
            'blocks_accreditation', ar.blocks_accreditation,
            'status', wdt.status,
            'issue_date', wdt.issue_date,
            'expiry_date', wdt.expiry_date,
            'buk_document_id', wdt.buk_document_id,
            'buk_document_name', wdt.buk_document_name,
            'buk_document_url', wdt.buk_document_url,
            'reviewed_at', wdt.reviewed_at,
            'reviewer_notes', wdt.reviewer_notes,
            'metadata', wdt.metadata
          )
          order by ar.process_scope asc, ar.category asc, ar.name asc
        ),
        '[]'::jsonb
      ) as payload
      from public.worker_document_tracking wdt
      join public.accreditation_requirements ar
        on ar.id = wdt.requirement_id
      where wdt.worker_accreditation_id = resolved_worker_accreditation_id
    ),
    audit_rows as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', aal.id,
            'event_type', aal.event_type,
            'event_summary', aal.event_summary,
            'payload', aal.payload,
            'actor_id', aal.actor_id,
            'created_at', aal.created_at,
            'actor_name', p.full_name
          )
          order by aal.created_at desc
        ),
        '[]'::jsonb
      ) as payload
      from public.accreditation_audit_log aal
      left join public.profiles p
        on p.id = aal.actor_id
      where aal.worker_accreditation_id = resolved_worker_accreditation_id
    )
    select jsonb_build_object(
      'worker',
      jsonb_build_object(
        'worker_accreditation_id', wa.id,
        'buk_employee_id', wa.employee_buk_employee_id,
        'full_name', wa.employee_full_name,
        'document_number', wa.employee_document_number,
        'document_type', wa.employee_document_type,
        'job_title', wa.employee_job_title,
        'contract_code', wa.contract_code,
        'area_name', wa.area_name,
        'site_id', wa.site_id,
        'site_name', s.name,
        'site_code', s.code,
        'accreditation_status', wa.accreditation_status,
        'accreditation_expiry_date', wa.accreditation_expiry_date,
        'required_documents_total', wa.required_documents_total,
        'approved_documents_total', wa.approved_documents_total,
        'pending_documents_total', wa.pending_documents_total,
        'expired_documents_total', wa.expired_documents_total
      ),
      'roster_context', (select payload from roster_context),
      'recent_roster_exceptions', (select payload from today_exceptions),
      'documents', (select payload from document_rows),
      'audit_log', (select payload from audit_rows)
    )
    from public.worker_accreditations wa
    join public.accreditation_sites s
      on s.id = wa.site_id
    where wa.id = resolved_worker_accreditation_id
  );
end;
$function$;

revoke all on function public.get_worker_accreditation_profile(text, uuid) from public, anon;
grant execute on function public.get_worker_accreditation_profile(text, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
