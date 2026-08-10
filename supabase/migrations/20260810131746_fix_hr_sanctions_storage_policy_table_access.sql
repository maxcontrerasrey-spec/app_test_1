begin;

create or replace function public.user_can_view_hr_sanction_document_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $function$
  select
    auth.uid() is not null
    and (
      public.user_can_manage_hr_sanctions(auth.uid())
      or exists (
        select 1
        from public.hr_sanction_documents hsd
        join public.hr_sanction_requests hsr on hsr.id = hsd.sanction_request_id
        where hsd.file_path = p_object_name
          and hsr.requester_user_id = auth.uid()
      )
    );
$function$;

revoke all on function public.user_can_view_hr_sanction_document_object(text) from public, anon, authenticated;
grant execute on function public.user_can_view_hr_sanction_document_object(text) to authenticated;

drop policy if exists "hr_sanctions_select_scoped" on storage.objects;
create policy "hr_sanctions_select_scoped"
on storage.objects for select
to authenticated
using (
  bucket_id = 'hr-sanctions'
  and public.user_can_view_hr_sanction_document_object(name)
);

notify pgrst, 'reload schema';

commit;
