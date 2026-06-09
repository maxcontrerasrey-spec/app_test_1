begin;

update public.document_types
set name = 'Certificado de Antecedentes'
where name = 'Certificado de Antecedentes para fines especiales';

update public.document_types
set name = 'Cédula de identidad'
where name = 'Copia de Fotocopia de cédula de identidad';

update public.document_types
set name = 'Certificado de estudios'
where name = 'Certificado de estudios (Licencia media, Título)';

update public.document_types
set name = 'Licencia de conducir'
where name = 'Copia de Licencia de conducir vigente por ambos lados';

notify pgrst, 'reload schema';

commit;
