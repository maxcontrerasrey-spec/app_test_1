begin;

create or replace function public.resolve_known_company_name(
  p_company_id bigint default null,
  p_contract_number text default null
)
returns text
language sql
immutable
set search_path = public
as $function$
  with resolved_company_keys as (
    select
      p_company_id as company_id,
      case
        when split_part(coalesce(p_contract_number, ''), ':', 2) ~ '^\d+$'
          then split_part(p_contract_number, ':', 2)::bigint
        else null
      end as contract_company_code
  )
  select case
    when nullif(trim(coalesce(p_contract_number, '')), '') in ('6170400010:0001', '6170400010:0004')
      then 'Consorcio nuevo norte SPA'
    when nullif(trim(coalesce(p_contract_number, '')), '') = '6170400011:0001'
      then 'Consorcio Andino SPA'
    when resolved_company_keys.company_id = 1 or resolved_company_keys.contract_company_code = 1
      then 'Buses JM Pullman S.A.'
    when resolved_company_keys.company_id = 3 or resolved_company_keys.contract_company_code = 2
      then 'Servicios Industriales Minardi S.A.'
    when resolved_company_keys.company_id = 4 or resolved_company_keys.contract_company_code = 4
      then 'Consorcio nuevo norte SPA'
    when resolved_company_keys.company_id = 5 or resolved_company_keys.contract_company_code = 5
      then 'Consorcio Andino SPA'
    when resolved_company_keys.company_id = 6 or resolved_company_keys.contract_company_code = 6
      then 'Transportes Plaza Vieja Spa'
    else null
  end
  from resolved_company_keys;
$function$;

update public.buk_contract_mappings bcm
set
  company_name = 'Consorcio nuevo norte SPA',
  updated_at = timezone('utc', now())
where (
    bcm.contract_number in ('6170400010:0001', '6170400010:0004')
    or bcm.buk_area_name_normalized = public.normalize_buk_area_name('CODELCO DRT')
    or public.normalize_buk_area_name(bcm.contract_name) = public.normalize_buk_area_name('CODELCO DRT')
  )
  and bcm.company_name is distinct from 'Consorcio nuevo norte SPA';

update public.internal_mobility_requests imr
set
  destination_company_name = 'Consorcio nuevo norte SPA',
  requires_termination = (
    imr.current_company_name is not null
    and imr.current_company_name is distinct from 'Consorcio nuevo norte SPA'
  ),
  updated_at = timezone('utc', now())
where (
    imr.destination_contract_id in (
      select c.id
      from public.contracts c
      where c.contract_number in ('6170400010:0001', '6170400010:0004')
         or public.normalize_buk_area_name(c.contract_name) = public.normalize_buk_area_name('CODELCO DRT')
    )
    or public.normalize_buk_area_name(imr.destination_area_name) = public.normalize_buk_area_name('CODELCO DRT')
    or imr.destination_contract_number in ('6170400010:0001', '6170400010:0004')
  )
  and (
    imr.destination_company_name is distinct from 'Consorcio nuevo norte SPA'
    or imr.requires_termination is distinct from (
      imr.current_company_name is not null
      and imr.current_company_name is distinct from 'Consorcio nuevo norte SPA'
    )
  );

update public.internal_mobility_request_snapshots imrs
set payload = jsonb_set(
  jsonb_set(
    coalesce(imrs.payload, '{}'::jsonb),
    '{destination_company_name}',
    to_jsonb('Consorcio nuevo norte SPA'::text),
    true
  ),
  '{requires_termination}',
  to_jsonb(
    imr.current_company_name is not null
    and imr.current_company_name is distinct from 'Consorcio nuevo norte SPA'
  ),
  true
)
from public.internal_mobility_requests imr
where imr.id = imrs.internal_mobility_request_id
  and (
    imr.destination_contract_id in (
      select c.id
      from public.contracts c
      where c.contract_number in ('6170400010:0001', '6170400010:0004')
         or public.normalize_buk_area_name(c.contract_name) = public.normalize_buk_area_name('CODELCO DRT')
    )
    or public.normalize_buk_area_name(imr.destination_area_name) = public.normalize_buk_area_name('CODELCO DRT')
    or imr.destination_contract_number in ('6170400010:0001', '6170400010:0004')
  )
  and (
    imrs.payload ->> 'destination_company_name' is distinct from 'Consorcio nuevo norte SPA'
    or coalesce((imrs.payload ->> 'requires_termination')::boolean, false) is distinct from (
      imr.current_company_name is not null
      and imr.current_company_name is distinct from 'Consorcio nuevo norte SPA'
    )
  );

notify pgrst, 'reload schema';

commit;
