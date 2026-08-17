begin;

update public.competency_legal_signers
set document_number = '15.365.142-6',
    updated_at = timezone('utc', now()),
    metadata = metadata || jsonb_build_object('run_source', 'user_confirmed_buk_identity')
where lower(trim(email)) = 'guillermo.zanartu@busesjm.com'
  and full_name = 'Guillermo Zañartu Apara';

do $function$
begin
  if not exists (
    select 1
    from public.competency_legal_signers
    where lower(trim(email)) = 'guillermo.zanartu@busesjm.com'
      and full_name = 'Guillermo Zañartu Apara'
      and document_number = '15.365.142-6'
  ) then
    raise exception 'No fue posible actualizar el RUN del representante legal Guillermo Zañartu Apara';
  end if;
end;
$function$;

notify pgrst, 'reload schema';

commit;
