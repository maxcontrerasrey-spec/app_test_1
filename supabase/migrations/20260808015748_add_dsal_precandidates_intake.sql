begin;

create table if not exists public.recruitment_precandidates (
  id uuid primary key default gen_random_uuid(),
  source_code text not null default 'dsal_public'
    check (source_code in ('dsal_public')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'archived')),
  national_id text not null,
  first_name text not null,
  last_name text not null,
  second_last_name text not null,
  full_name text not null,
  address_line text not null,
  region text not null,
  current_city text not null,
  driver_license_classes text[] not null default '{}',
  dsal_role text not null
    check (dsal_role in ('Interno Mina', 'Furgón Eléctrico', 'Bus Eléctrico', 'Ciudades Base')),
  phone text not null,
  personal_email text not null,
  comments text,
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_comment text,
  approved_recruitment_case_id uuid references public.recruitment_cases (id) on delete set null,
  approved_case_candidate_id uuid references public.recruitment_case_candidates (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_recruitment_precandidates_pending_national_id
  on public.recruitment_precandidates (national_id)
  where status = 'pending';

create index if not exists idx_recruitment_precandidates_status_submitted
  on public.recruitment_precandidates (status, submitted_at desc);

drop trigger if exists trg_recruitment_precandidates_set_updated_at on public.recruitment_precandidates;
create trigger trg_recruitment_precandidates_set_updated_at
before update on public.recruitment_precandidates
for each row execute function public.set_updated_at();

alter table public.recruitment_precandidates enable row level security;

drop policy if exists "recruitment_precandidates_no_direct_select" on public.recruitment_precandidates;
create policy "recruitment_precandidates_no_direct_select"
on public.recruitment_precandidates
for select
to authenticated
using (false);

drop policy if exists "recruitment_precandidates_no_direct_insert" on public.recruitment_precandidates;
create policy "recruitment_precandidates_no_direct_insert"
on public.recruitment_precandidates
for insert
to anon, authenticated
with check (false);

drop policy if exists "recruitment_precandidates_no_direct_update" on public.recruitment_precandidates;
create policy "recruitment_precandidates_no_direct_update"
on public.recruitment_precandidates
for update
to authenticated
using (false)
with check (false);

revoke all on table public.recruitment_precandidates from public, anon, authenticated;

create or replace function public.normalize_dsal_precandidate_text(p_value text)
returns text
language sql
immutable
set search_path = public
as $function$
  select nullif(regexp_replace(trim(coalesce(p_value, '')), '\s+', ' ', 'g'), '')
$function$;

create or replace function public.normalize_dsal_precandidate_name(p_value text)
returns text
language sql
immutable
set search_path = public
as $function$
  select nullif(initcap(lower(regexp_replace(trim(coalesce(p_value, '')), '\s+', ' ', 'g'))), '')
$function$;

create or replace function public.normalize_dsal_precandidate_rut(p_value text)
returns text
language sql
immutable
set search_path = public
as $function$
  select upper(left(regexp_replace(coalesce(p_value, ''), '[^0-9kK]', '', 'g'), 9))
$function$;

create or replace function public.is_valid_dsal_precandidate_rut(p_value text)
returns boolean
language plpgsql
immutable
set search_path = public
as $function$
declare
  normalized_rut text := public.normalize_dsal_precandidate_rut(p_value);
  body text;
  verifier text;
  expected text;
  sum_value integer := 0;
  multiplier integer := 2;
  index_value integer;
  remainder integer;
begin
  if length(normalized_rut) < 2 then
    return false;
  end if;

  body := left(normalized_rut, length(normalized_rut) - 1);
  verifier := right(normalized_rut, 1);

  if body !~ '^[0-9]+$' or verifier !~ '^[0-9K]$' then
    return false;
  end if;

  for index_value in reverse length(body)..1 loop
    sum_value := sum_value + substring(body from index_value for 1)::integer * multiplier;
    multiplier := case when multiplier = 7 then 2 else multiplier + 1 end;
  end loop;

  remainder := 11 - (sum_value % 11);
  expected := case
    when remainder = 11 then '0'
    when remainder = 10 then 'K'
    else remainder::text
  end;

  return verifier = expected;
end;
$function$;

create or replace function public.submit_dsal_precandidate_application(
  p_national_id text,
  p_first_name text,
  p_last_name text,
  p_second_last_name text,
  p_address_line text,
  p_region text,
  p_current_city text,
  p_driver_license_classes text[],
  p_dsal_role text,
  p_phone text,
  p_personal_email text,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  allowed_licenses constant text[] := array['A1 (Ley 18.290)', 'A2', 'A3', 'B'];
  normalized_national_id text := public.normalize_dsal_precandidate_rut(p_national_id);
  normalized_first_name text := public.normalize_dsal_precandidate_name(p_first_name);
  normalized_last_name text := public.normalize_dsal_precandidate_name(p_last_name);
  normalized_second_last_name text := public.normalize_dsal_precandidate_name(p_second_last_name);
  normalized_address_line text := public.normalize_dsal_precandidate_text(p_address_line);
  normalized_region text := public.normalize_dsal_precandidate_text(p_region);
  normalized_current_city text := public.normalize_dsal_precandidate_name(p_current_city);
  normalized_phone text := public.normalize_dsal_precandidate_text(p_phone);
  normalized_personal_email text := lower(public.normalize_dsal_precandidate_text(p_personal_email));
  normalized_comments text := public.normalize_dsal_precandidate_text(p_comments);
  normalized_licenses text[];
  invalid_licenses text[];
  saved_id uuid;
  did_update boolean := false;
begin
  if not public.is_valid_dsal_precandidate_rut(normalized_national_id) then
    raise exception 'El RUT ingresado no es válido';
  end if;

  if normalized_first_name is null
    or normalized_last_name is null
    or normalized_second_last_name is null
    or normalized_address_line is null
    or normalized_region is null
    or normalized_current_city is null
    or normalized_phone is null
    or normalized_personal_email is null then
    raise exception 'Completa todos los campos obligatorios';
  end if;

  if normalized_personal_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'El email personal no tiene un formato válido';
  end if;

  if p_dsal_role not in ('Interno Mina', 'Furgón Eléctrico', 'Bus Eléctrico', 'Ciudades Base') then
    raise exception 'Selecciona un rol DSAL válido';
  end if;

  select coalesce(array_agg(distinct license order by license), '{}'::text[])
    into normalized_licenses
    from unnest(coalesce(p_driver_license_classes, '{}'::text[])) as license
   where nullif(trim(license), '') is not null;

  if cardinality(normalized_licenses) = 0 then
    raise exception 'Selecciona al menos una licencia de conducir';
  end if;

  select coalesce(array_agg(license), '{}'::text[])
    into invalid_licenses
    from unnest(normalized_licenses) as license
   where license <> all(allowed_licenses);

  if cardinality(invalid_licenses) > 0 then
    raise exception 'La postulación contiene licencias no permitidas';
  end if;

  insert into public.recruitment_precandidates (
    national_id,
    first_name,
    last_name,
    second_last_name,
    full_name,
    address_line,
    region,
    current_city,
    driver_license_classes,
    dsal_role,
    phone,
    personal_email,
    comments,
    metadata
  )
  values (
    normalized_national_id,
    normalized_first_name,
    normalized_last_name,
    normalized_second_last_name,
    concat_ws(' ', normalized_first_name, normalized_last_name, normalized_second_last_name),
    normalized_address_line,
    normalized_region,
    normalized_current_city,
    normalized_licenses,
    p_dsal_role,
    normalized_phone,
    normalized_personal_email,
    normalized_comments,
    jsonb_build_object('source', 'public_dsal_application')
  )
  on conflict (national_id) where status = 'pending'
  do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    second_last_name = excluded.second_last_name,
    full_name = excluded.full_name,
    address_line = excluded.address_line,
    region = excluded.region,
    current_city = excluded.current_city,
    driver_license_classes = excluded.driver_license_classes,
    dsal_role = excluded.dsal_role,
    phone = excluded.phone,
    personal_email = excluded.personal_email,
    comments = excluded.comments,
    submitted_at = timezone('utc', now()),
    metadata = coalesce(public.recruitment_precandidates.metadata, '{}'::jsonb) || jsonb_build_object(
      'last_public_submit_at', timezone('utc', now())
    )
  returning id, xmax <> 0 into saved_id, did_update;

  return jsonb_build_object(
    'id', saved_id,
    'status', case when did_update then 'updated' else 'received' end
  );
end;
$function$;

create or replace function public.get_recruitment_precandidates_page(
  p_status text default 'pending',
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_status text := coalesce(nullif(trim(p_status), ''), 'pending');
  normalized_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  if normalized_status not in ('pending', 'approved', 'rejected', 'archived', 'all') then
    raise exception 'Estado de precandidato inválido';
  end if;

  with filtered as (
    select rp.*
      from public.recruitment_precandidates rp
     where (normalized_status = 'all' or rp.status = normalized_status)
       and (
         normalized_search is null
         or lower(rp.full_name) like '%' || normalized_search || '%'
         or lower(rp.national_id) like '%' || normalized_search || '%'
         or lower(rp.personal_email) like '%' || normalized_search || '%'
         or lower(rp.phone) like '%' || normalized_search || '%'
         or lower(rp.dsal_role) like '%' || normalized_search || '%'
       )
  ),
  counted as (
    select count(*)::integer as total_count from filtered
  ),
  page_items as (
    select *
      from filtered
     order by submitted_at desc, created_at desc
     limit safe_limit
     offset safe_offset
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(page_items) order by page_items.submitted_at desc, page_items.created_at desc), '[]'::jsonb),
    'total_count', (select total_count from counted),
    'summary', jsonb_build_object(
      'pending', (select count(*) from public.recruitment_precandidates where status = 'pending'),
      'approved', (select count(*) from public.recruitment_precandidates where status = 'approved'),
      'rejected', (select count(*) from public.recruitment_precandidates where status = 'rejected')
    )
  )
    into payload
    from page_items;

  return coalesce(payload, jsonb_build_object(
    'items', '[]'::jsonb,
    'total_count', 0,
    'summary', jsonb_build_object('pending', 0, 'approved', 0, 'rejected', 0)
  ));
end;
$function$;

create or replace function public.approve_recruitment_precandidate(
  p_precandidate_id uuid,
  p_case_id uuid,
  p_review_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  precandidate_record public.recruitment_precandidates%rowtype;
  created_candidate_id uuid;
  created_profile_id uuid;
  normalized_review_comment text := public.normalize_dsal_precandidate_text(p_review_comment);
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into precandidate_record
    from public.recruitment_precandidates rp
   where rp.id = p_precandidate_id
   for update;

  if precandidate_record.id is null then
    raise exception 'No existe el precandidato indicado';
  end if;

  if precandidate_record.status <> 'pending' then
    raise exception 'Solo se pueden aprobar precandidatos pendientes';
  end if;

  select out_case_candidate_id, out_candidate_profile_id
    into created_candidate_id, created_profile_id
    from public.add_candidate_to_recruitment_case(
      p_case_id,
      precandidate_record.national_id,
      precandidate_record.full_name,
      precandidate_record.personal_email,
      precandidate_record.phone
    );

  update public.candidate_profiles cp
     set document_type = 'RUT',
         first_name = precandidate_record.first_name,
         last_name = precandidate_record.last_name,
         second_last_name = precandidate_record.second_last_name,
         full_name = precandidate_record.full_name,
         personal_email = precandidate_record.personal_email,
         phone = precandidate_record.phone,
         address_line = precandidate_record.address_line,
         street_name = precandidate_record.address_line,
         street_number = null,
         region = precandidate_record.region,
         current_city = precandidate_record.current_city,
         country = coalesce(nullif(cp.country, ''), 'Chile'),
         driver_license_class = array_to_string(precandidate_record.driver_license_classes, ', '),
         source = 'dsal_public_preapplication',
         updated_at = timezone('utc', now())
   where cp.id = created_profile_id;

  update public.recruitment_precandidates rp
     set status = 'approved',
         reviewed_at = timezone('utc', now()),
         reviewed_by = current_user_id,
         review_comment = normalized_review_comment,
         approved_recruitment_case_id = p_case_id,
         approved_case_candidate_id = created_candidate_id,
         metadata = coalesce(rp.metadata, '{}'::jsonb) || jsonb_build_object(
           'approved_driver_license_classes', precandidate_record.driver_license_classes,
           'approved_dsal_role', precandidate_record.dsal_role
         )
   where rp.id = precandidate_record.id;

  return jsonb_build_object(
    'case_candidate_id', created_candidate_id,
    'candidate_profile_id', created_profile_id
  );
end;
$function$;

create or replace function public.reject_recruitment_precandidate(
  p_precandidate_id uuid,
  p_review_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_review_comment text := public.normalize_dsal_precandidate_text(p_review_comment);
  affected_count integer;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  update public.recruitment_precandidates rp
     set status = 'rejected',
         reviewed_at = timezone('utc', now()),
         reviewed_by = current_user_id,
         review_comment = normalized_review_comment
   where rp.id = p_precandidate_id
     and rp.status = 'pending';

  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    raise exception 'Solo se pueden rechazar precandidatos pendientes';
  end if;
end;
$function$;

revoke all on function public.normalize_dsal_precandidate_text(text) from public, anon, authenticated;
revoke all on function public.normalize_dsal_precandidate_name(text) from public, anon, authenticated;
revoke all on function public.normalize_dsal_precandidate_rut(text) from public, anon, authenticated;
revoke all on function public.is_valid_dsal_precandidate_rut(text) from public, anon, authenticated;

revoke all on function public.submit_dsal_precandidate_application(
  text, text, text, text, text, text, text, text[], text, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_dsal_precandidate_application(
  text, text, text, text, text, text, text, text[], text, text, text, text
) to anon, authenticated;

revoke all on function public.get_recruitment_precandidates_page(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_recruitment_precandidates_page(text, text, integer, integer) to authenticated;

revoke all on function public.approve_recruitment_precandidate(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_recruitment_precandidate(uuid, uuid, text) to authenticated;

revoke all on function public.reject_recruitment_precandidate(uuid, text) from public, anon, authenticated;
grant execute on function public.reject_recruitment_precandidate(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
