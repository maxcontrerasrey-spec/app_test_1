set check_function_bodies = off;

create sequence if not exists public.competency_certificate_folio_seq;

select setval(
  'public.competency_certificate_folio_seq',
  greatest(
    (select last_value from public.competency_certificate_folio_seq),
    1150
  ),
  true
);

alter table public.competency_certificates
  alter column folio set default (
    to_char(timezone('America/Santiago', now()), 'DDMMYYYYHH24MI') ||
    nextval('public.competency_certificate_folio_seq')::text
  );

comment on column public.competency_certificates.folio is
  'Codigo auditable de certificado: DDMMAAAAHHMM en horario America/Santiago concatenado con correlativo desde 1151.';

notify pgrst, 'reload schema';
