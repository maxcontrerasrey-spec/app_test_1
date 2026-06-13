begin;

insert into public.document_types (
  name,
  is_critical,
  requires_expiry_date,
  active,
  applies_to_driver,
  applies_to_other,
  required_for_driver,
  required_for_other
)
select
  'Psicosensotecnico',
  true,
  true,
  true,
  true,
  false,
  true,
  false
where not exists (
  select 1
  from public.document_types
  where name = 'Psicosensotecnico'
);

update public.document_types
set
  active = true,
  is_critical = true,
  requires_expiry_date = true,
  applies_to_driver = true,
  applies_to_other = false,
  required_for_driver = true,
  required_for_other = false
where name = 'Psicosensotecnico';

update public.document_types
set requires_expiry_date = case
  when name in (
    'Cédula de identidad',
    'Copia de Fotocopia de cédula de identidad',
    'Licencia de conducir',
    'Copia de Licencia de conducir vigente por ambos lados',
    'Examen Preocupacional',
    'Psicosensotecnico'
  ) then true
  else false
end
where active = true;

notify pgrst, 'reload schema';

commit;
