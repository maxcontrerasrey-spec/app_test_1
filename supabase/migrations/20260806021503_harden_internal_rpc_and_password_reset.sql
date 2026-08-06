begin;

-- A password-reset flag must only be cleared by an actual Auth password change.
-- Direct profile writes previously let any authenticated user bypass the forced
-- password-change route.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.clear_must_reset_password_after_auth_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles
       set must_reset_password = false,
           updated_at = timezone('utc', now())
     where id = new.id
       and must_reset_password = true;
  end if;

  return new;
end;
$function$;

revoke all on function private.clear_must_reset_password_after_auth_change() from public, anon, authenticated;

drop trigger if exists trg_clear_must_reset_password_after_auth_change on auth.users;
create trigger trg_clear_must_reset_password_after_auth_change
after update of encrypted_password on auth.users
for each row
when (new.encrypted_password is distinct from old.encrypted_password)
execute function private.clear_must_reset_password_after_auth_change();

revoke update on public.profiles from authenticated;

create or replace function public.validate_worker_accreditation_document_upload(
  p_buk_employee_id text,
  p_site_id uuid,
  p_requirement_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_employee_id text := trim(coalesce(p_buk_employee_id, ''));
  normalized_status text := lower(trim(coalesce(p_status, '')));
  worker_job_title text;
begin
  if current_user_id is null
     or not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para subir documentos de acreditacion';
  end if;

  if normalized_status not in ('pending', 'submitted', 'approved', 'rejected', 'expired') then
    raise exception 'Estado documental invalido para acreditacion';
  end if;

  select coalesce(
           nullif(trim(e.job_title), ''),
           nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
           nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
           nullif(trim(e.raw_payload ->> 'job_title'), '')
         )
    into worker_job_title
    from public.employees_active_current e
   where e.buk_employee_id = normalized_employee_id
   limit 1;

  if not found then
    raise exception 'Trabajador activo no encontrado en BUK';
  end if;

  if not exists (
    select 1
      from public.accreditation_sites s
     where s.id = p_site_id
       and s.is_active = true
  ) then
    raise exception 'Faena de acreditacion invalida o inactiva';
  end if;

  if not exists (
    select 1
      from public.accreditation_requirements r
     where r.id = p_requirement_id
       and r.is_active = true
       and (
         exists (
           select 1
             from public.accreditation_matrix m
            where m.site_id = p_site_id
              and m.requirement_id = r.id
              and m.is_active = true
              and (
                m.job_title is null
                or nullif(lower(trim(m.job_title)), '') =
                   nullif(lower(trim(coalesce(worker_job_title, ''))), '')
              )
         )
         or exists (
           select 1
             from public.accreditation_site_standards ss
             join public.accreditation_standards st
               on st.id = ss.standard_id
              and st.is_active = true
             join public.accreditation_standard_requirements sr
               on sr.standard_id = st.id
              and sr.is_active = true
            where ss.site_id = p_site_id
              and ss.is_active = true
              and sr.requirement_id = r.id
         )
       )
  ) then
    raise exception 'El requisito no corresponde a la faena y cargo del trabajador';
  end if;

  return true;
end;
$function$;

revoke all on function public.validate_worker_accreditation_document_upload(text, uuid, uuid, text)
  from public, anon;
grant execute on function public.validate_worker_accreditation_document_upload(text, uuid, uuid, text)
  to authenticated, service_role;

create or replace function public.claim_competency_certificate_generation(
  p_certificate_id uuid,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  claimed_id uuid;
begin
  update public.competency_certificates
     set certificate_status = 'generating',
         buk_attempt_count = case
           when buk_upload_status = 'failed' then coalesce(buk_attempt_count, 0) + 1
           else greatest(coalesce(buk_attempt_count, 0), 1)
         end,
         buk_last_error = null,
         generated_by = p_actor_id,
         updated_at = timezone('utc', now())
   where id = p_certificate_id
     and (
       certificate_status <> 'generating'
       or updated_at < timezone('utc', now()) - interval '15 minutes'
     )
  returning id into claimed_id;

  return claimed_id is not null;
end;
$function$;

revoke all on function public.claim_competency_certificate_generation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_competency_certificate_generation(uuid, uuid)
  to service_role;

-- Internal SECURITY DEFINER helpers are called by trusted wrappers, triggers or
-- the service worker. They are not part of the authenticated Data API surface.
revoke all on function public.reset_candidate_document_validation(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reset_candidate_document_validation(uuid, uuid, text)
  to service_role;

revoke all on function public.finalize_buk_sync_job_success(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_buk_sync_job_success(uuid, text, jsonb)
  to service_role;

revoke all on function public.finalize_buk_sync_job_existing_active_employee(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_buk_sync_job_existing_active_employee(uuid, text, jsonb)
  to service_role;

revoke all on function public.get_bi_employee_population(text, text[], text[])
  from public, anon, authenticated;
grant execute on function public.get_bi_employee_population(text, text[], text[])
  to service_role;

revoke all on function public.prepare_operations_service_entry_batch(jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_operations_service_entry_batch(jsonb, uuid)
  to service_role;

revoke all on function public.process_pending_approval_reminders()
  from public, anon, authenticated;
grant execute on function public.process_pending_approval_reminders()
  to service_role;

revoke all on function public.enqueue_hiring_pending_approval_email(bigint, boolean)
  from public, anon, authenticated;
revoke all on function public.enqueue_hiring_rejected_email(bigint)
  from public, anon, authenticated;
revoke all on function public.enqueue_internal_mobility_pending_approval_email(bigint)
  from public, anon, authenticated;
revoke all on function public.enqueue_internal_mobility_recruitment_handoff_email(uuid)
  from public, anon, authenticated;
revoke all on function public.enqueue_mobility_rejected_email(bigint)
  from public, anon, authenticated;
revoke all on function public.enqueue_personnel_to_hire_email(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.enqueue_recruitment_handoff_email(uuid)
  from public, anon, authenticated;
revoke all on function public.enqueue_who_pending_approval_email(bigint, boolean)
  from public, anon, authenticated;

grant execute on function public.enqueue_hiring_pending_approval_email(bigint, boolean) to service_role;
grant execute on function public.enqueue_hiring_rejected_email(bigint) to service_role;
grant execute on function public.enqueue_internal_mobility_pending_approval_email(bigint) to service_role;
grant execute on function public.enqueue_internal_mobility_recruitment_handoff_email(uuid) to service_role;
grant execute on function public.enqueue_mobility_rejected_email(bigint) to service_role;
grant execute on function public.enqueue_personnel_to_hire_email(uuid, boolean) to service_role;
grant execute on function public.enqueue_recruitment_handoff_email(uuid) to service_role;
grant execute on function public.enqueue_who_pending_approval_email(bigint, boolean) to service_role;

notify pgrst, 'reload schema';

commit;
