begin;

create or replace function public.resolve_known_company_name(
  p_company_id bigint default null,
  p_contract_number text default null
)
returns text
language sql
stable
set search_path = public
as $function$
  with inputs as (
    select
      p_company_id as company_id,
      nullif(trim(coalesce(p_contract_number, '')), '') as contract_number
  ),
  mapping_company as (
    select nullif(trim(bcm.company_name), '') as company_name
    from public.buk_contract_mappings bcm
    join inputs on inputs.contract_number is not null
      and nullif(trim(bcm.contract_number), '') = inputs.contract_number
    where nullif(trim(bcm.company_name), '') is not null
    order by bcm.is_operational desc, bcm.is_one_to_one desc, bcm.updated_at desc nulls last, bcm.id desc
    limit 1
  ),
  resolved_company_keys as (
    select
      inputs.company_id,
      case
        when split_part(coalesce(inputs.contract_number, ''), ':', 2) ~ '^\d+$'
          then split_part(inputs.contract_number, ':', 2)::bigint
        else null
      end as contract_company_code
    from inputs
  )
  select coalesce(
    (select mapping_company.company_name from mapping_company),
    case
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
  )
  from resolved_company_keys;
$function$;

create temp table tmp_authoritative_buk_mapping_companies on commit drop as
with mapping_employee_company as (
  select
    bcm.id as mapping_id,
    bcm.contract_id,
    bcm.contract_number,
    bcm.contract_name,
    bcm.buk_area_code,
    bcm.buk_area_name,
    bcm.company_name as erp_company_name,
    public.resolve_known_company_name(public.extract_buk_company_id(e.raw_payload), null) as buk_company_name,
    count(*) as sample_count
  from public.buk_contract_mappings bcm
  join public.employees_active_current e
    on e.is_active = true
   and public.resolve_known_company_name(public.extract_buk_company_id(e.raw_payload), null) is not null
   and (
      (
        nullif(trim(bcm.buk_area_code), '') is not null
        and (
          nullif(trim(e.raw_payload -> 'current_job' ->> 'cost_center'), '') = nullif(trim(bcm.buk_area_code), '')
          or nullif(trim(e.raw_payload -> 'current_job' ->> 'area_id'), '') = nullif(trim(bcm.buk_area_code), '')
        )
      )
      or (
        nullif(trim(coalesce(bcm.buk_area_name_normalized, public.normalize_buk_area_name(bcm.buk_area_name))), '') is not null
        and public.normalize_buk_area_name(e.area_name) = coalesce(
          bcm.buk_area_name_normalized,
          public.normalize_buk_area_name(bcm.buk_area_name)
        )
      )
    )
  where bcm.is_operational is true
    and bcm.is_one_to_one is true
    and bcm.contract_id is not null
  group by
    bcm.id,
    bcm.contract_id,
    bcm.contract_number,
    bcm.contract_name,
    bcm.buk_area_code,
    bcm.buk_area_name,
    bcm.company_name,
    public.resolve_known_company_name(public.extract_buk_company_id(e.raw_payload), null)
),
ranked_mapping_companies as (
  select
    mapping_employee_company.*,
    rank() over (
      partition by mapping_employee_company.mapping_id
      order by mapping_employee_company.sample_count desc
    ) as company_rank,
    count(*) over (
      partition by mapping_employee_company.mapping_id, mapping_employee_company.sample_count
    ) as companies_with_same_sample_count
  from mapping_employee_company
)
select
  mapping_id,
  contract_id,
  contract_number,
  contract_name,
  buk_area_code,
  buk_area_name,
  erp_company_name,
  buk_company_name,
  sample_count
from ranked_mapping_companies
where company_rank = 1
  and companies_with_same_sample_count = 1
  and erp_company_name is distinct from buk_company_name;

update public.buk_contract_mappings bcm
set
  company_name = authoritative.buk_company_name,
  updated_at = timezone('utc', now())
from tmp_authoritative_buk_mapping_companies authoritative
where authoritative.mapping_id = bcm.id
  and bcm.company_name is distinct from authoritative.buk_company_name;

update public.internal_mobility_requests imr
set
  destination_company_name = authoritative.buk_company_name,
  requires_termination = (
    imr.current_company_name is not null
    and imr.current_company_name is distinct from authoritative.buk_company_name
  ),
  updated_at = timezone('utc', now())
from tmp_authoritative_buk_mapping_companies authoritative
where (
    imr.destination_contract_id = authoritative.contract_id
    or nullif(trim(imr.destination_contract_number), '') = nullif(trim(authoritative.contract_number), '')
    or (
      nullif(trim(imr.destination_area_name), '') is not null
      and public.normalize_buk_area_name(imr.destination_area_name) = public.normalize_buk_area_name(authoritative.buk_area_name)
    )
  )
  and (
    imr.destination_company_name is distinct from authoritative.buk_company_name
    or imr.requires_termination is distinct from (
      imr.current_company_name is not null
      and imr.current_company_name is distinct from authoritative.buk_company_name
    )
  );

update public.internal_mobility_request_snapshots imrs
set payload = jsonb_set(
  jsonb_set(
    coalesce(imrs.payload, '{}'::jsonb),
    '{destination_company_name}',
    to_jsonb(authoritative.buk_company_name),
    true
  ),
  '{requires_termination}',
  to_jsonb(
    imr.current_company_name is not null
    and imr.current_company_name is distinct from authoritative.buk_company_name
  ),
  true
)
from public.internal_mobility_requests imr
join tmp_authoritative_buk_mapping_companies authoritative
  on (
    imr.destination_contract_id = authoritative.contract_id
    or nullif(trim(imr.destination_contract_number), '') = nullif(trim(authoritative.contract_number), '')
    or (
      nullif(trim(imr.destination_area_name), '') is not null
      and public.normalize_buk_area_name(imr.destination_area_name) = public.normalize_buk_area_name(authoritative.buk_area_name)
    )
  )
where imr.id = imrs.internal_mobility_request_id
  and (
    imrs.payload ->> 'destination_company_name' is distinct from authoritative.buk_company_name
    or coalesce((imrs.payload ->> 'requires_termination')::boolean, false) is distinct from (
      imr.current_company_name is not null
      and imr.current_company_name is distinct from authoritative.buk_company_name
    )
  );

notify pgrst, 'reload schema';

commit;
