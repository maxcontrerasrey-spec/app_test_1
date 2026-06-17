begin;

update public.document_types
set
  active = true,
  applies_to_other = true,
  required_for_other = false,
  is_critical = required_for_driver or false
where name in (
  'Licencia de conducir',
  'Hoja de vida del conductor',
  'Examen Teórico de Instructor',
  'Examen Práctico de Instructor',
  'Examen Preocupacional',
  'Psicosensotecnico'
);

update public.document_types
set
  active = true,
  applies_to_other = true,
  required_for_other = false,
  is_critical = required_for_driver or false
where name in (
  'Copia de Licencia de conducir vigente por ambos lados',
  'Exámenes preocupacionales'
);

notify pgrst, 'reload schema';

commit;
