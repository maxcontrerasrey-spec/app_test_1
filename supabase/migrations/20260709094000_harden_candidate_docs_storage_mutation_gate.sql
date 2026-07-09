begin;

create or replace function public.user_can_manage_candidate_document_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  current_user_id uuid;
  first_folder text;
  case_candidate_id uuid;
  case_id uuid;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return false;
  end if;

  first_folder := (storage.foldername(p_object_name))[1];

  if first_folder is null or first_folder !~* uuid_pattern then
    return false;
  end if;

  case_candidate_id := first_folder::uuid;

  select rcc.recruitment_case_id
    into case_id
    from public.recruitment_case_candidates rcc
   where rcc.id = case_candidate_id;

  if case_id is null then
    return false;
  end if;

  return (
    public.user_can_manage_recruitment_case(current_user_id, case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, case_candidate_id)
  );
end;
$$;

revoke all on function public.user_can_manage_candidate_document_object(text) from public, anon;
grant execute on function public.user_can_manage_candidate_document_object(text) to authenticated;

drop policy if exists "candidate_docs_insert_scoped" on storage.objects;
drop policy if exists "candidate_docs_update_scoped" on storage.objects;
drop policy if exists "candidate_docs_delete_scoped" on storage.objects;

create policy "candidate_docs_insert_scoped"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'candidate-docs'
  and public.user_can_manage_candidate_document_object(name)
);

create policy "candidate_docs_update_scoped"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'candidate-docs'
  and public.user_can_manage_candidate_document_object(name)
)
with check (
  bucket_id = 'candidate-docs'
  and public.user_can_manage_candidate_document_object(name)
);

create policy "candidate_docs_delete_scoped"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'candidate-docs'
  and public.user_can_manage_candidate_document_object(name)
);

create or replace function public.upload_candidate_document(
  p_case_candidate_id uuid,
  p_document_type_id uuid,
  p_file_path text,
  p_expiry_date date default null
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_rec public.recruitment_case_candidates%rowtype;
  path_case_candidate_id text;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into candidate_rec
    from public.recruitment_case_candidates
   where id = p_case_candidate_id;

  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not (
    public.user_can_manage_recruitment_case(current_user_id, candidate_rec.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_rec.id)
  ) then
    raise exception 'Sin permisos para cargar documentos en este caso';
  end if;

  path_case_candidate_id := (storage.foldername(p_file_path))[1];

  if path_case_candidate_id is null or path_case_candidate_id <> p_case_candidate_id::text then
    raise exception 'Ruta de documento invalida para este candidato';
  end if;

  insert into public.candidate_documents (
    candidate_profile_id,
    recruitment_case_id,
    document_type_id,
    file_path,
    expiry_date,
    status,
    uploaded_by,
    updated_at
  )
  values (
    candidate_rec.candidate_profile_id,
    candidate_rec.recruitment_case_id,
    p_document_type_id,
    p_file_path,
    p_expiry_date,
    'uploaded',
    current_user_id,
    timezone('utc', now())
  )
  on conflict (recruitment_case_id, candidate_profile_id, document_type_id) do update
  set
    file_path = excluded.file_path,
    expiry_date = excluded.expiry_date,
    status = 'uploaded',
    uploaded_by = excluded.uploaded_by,
    reviewed_at = null,
    reviewed_by = null,
    reviewer_notes = null,
    updated_at = timezone('utc', now());

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  )
  values (
    candidate_rec.recruitment_case_id,
    p_case_candidate_id,
    current_user_id,
    'document_uploaded',
    jsonb_build_object('document_type_id', p_document_type_id)
  );
end;
$function$;

revoke all on function public.upload_candidate_document(uuid, uuid, text, date) from public, anon;
grant execute on function public.upload_candidate_document(uuid, uuid, text, date) to authenticated;

notify pgrst, 'reload schema';

commit;
