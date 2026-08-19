begin;

-- DSAL may arrive from BUK with a center/cost-code suffix, for example
-- "CODELCO - DSAL (6170400011:0005)". The legal-signature scope is the
-- Salvador contract family, not one exact display string.
create or replace function public.competency_requires_legal_signature(
  area_name_input text,
  contract_code_input text
)
returns boolean
language sql
immutable
as $function$
  select
    lower(regexp_replace(lower(trim(coalesce(area_name_input, ''))), '[^a-z0-9]+', '-', 'g')) like 'codelco-dsal%'
    or lower(regexp_replace(lower(trim(coalesce(contract_code_input, ''))), '[^a-z0-9:]+', '', 'g')) in ('6170400011:0001', '0000000170:0001');
$function$;

notify pgrst, 'reload schema';

commit;
