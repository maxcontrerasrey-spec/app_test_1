-- EEES-DB-005: approved
-- owner: Comunicaciones / Engineering
-- rollback: hide the visual editor route and retain the published snapshot and history; remove data only in an explicitly reviewed migration.

begin;

create table if not exists public.communications_site_state (
  site_key text primary key check (site_key = 'home'),
  draft_data jsonb not null,
  published_data jsonb not null,
  draft_revision integer not null default 1 check (draft_revision > 0),
  published_version integer not null default 1 check (published_version > 0),
  draft_updated_by uuid references public.profiles(id) on delete set null,
  draft_updated_at timestamptz not null default timezone('utc', now()),
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.communications_site_versions (
  version integer primary key check (version > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  data jsonb not null,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default timezone('utc', now()),
  restored_from_version integer references public.communications_site_versions(version) on delete restrict
);

alter table public.communications_site_state enable row level security;
alter table public.communications_site_versions enable row level security;
drop policy if exists communications_site_state_no_direct_access on public.communications_site_state;
create policy communications_site_state_no_direct_access on public.communications_site_state
for all to authenticated using (false) with check (false);
drop policy if exists communications_site_versions_no_direct_access on public.communications_site_versions;
create policy communications_site_versions_no_direct_access on public.communications_site_versions
for all to authenticated using (false) with check (false);
revoke all on public.communications_site_state from public, anon, authenticated;
revoke all on public.communications_site_versions from public, anon, authenticated;

insert into public.communications_site_versions (version, schema_version, data)
values (
  1,
  1,
  '{"root":{"props":{"title":"Comunicaciones","tagline":"Un espacio para informarnos, compartir y crecer juntos.","theme":"buses-jm","font":"institucional","footer":"Portal interno · Buses JM"}},"content":[{"type":"HeroSection","props":{"id":"hero-inicial","eyebrow":"PORTAL CORPORATIVO","title":"Comunicaciones Buses JM","summary":"Noticias, historias y novedades de nuestros equipos.","tone":"destacado"}},{"type":"NewsSection","props":{"id":"noticias-inicial","title":"Lo que está pasando","description":"Noticias y comunicados de nuestra comunidad.","limit":6,"layout":"grilla"}},{"type":"EventsSection","props":{"id":"agenda-inicial","title":"Próximas actividades","description":"Encuentros y actividades para nuestra comunidad.","limit":3}},{"type":"BulletinsSection","props":{"id":"boletines-inicial","title":"Nuestros boletines","description":"Lee y descarga las últimas ediciones.","limit":4}}],"zones":{}}'::jsonb
)
on conflict (version) do nothing;

insert into public.communications_site_state (
  site_key, draft_data, published_data, draft_revision, published_version
)
select 'home', version_row.data, version_row.data, 1, version_row.version
from public.communications_site_versions version_row
where version_row.version = 1
on conflict (site_key) do nothing;

create or replace function public.is_valid_communications_site_data(p_data jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $function$
declare
  block jsonb;
  block_type text;
begin
  if jsonb_typeof(p_data) is distinct from 'object'
    or jsonb_typeof(p_data -> 'content') is distinct from 'array'
    or jsonb_typeof(p_data #> '{root,props}') is distinct from 'object'
    or octet_length(p_data::text) > 262144
    or jsonb_array_length(p_data -> 'content') not between 1 and 20 then
    return false;
  end if;

  if coalesce(p_data #>> '{root,props,theme}', '') not in ('buses-jm', 'andino', 'neutro')
    or coalesce(p_data #>> '{root,props,font}', '') not in ('institucional', 'sistema')
    or char_length(coalesce(p_data #>> '{root,props,title}', '')) not between 2 and 60
    or char_length(coalesce(p_data #>> '{root,props,tagline}', '')) > 180
    or char_length(coalesce(p_data #>> '{root,props,footer}', '')) > 180 then
    return false;
  end if;

  for block in select value from jsonb_array_elements(p_data -> 'content') loop
    block_type := block ->> 'type';
    if block_type is null
      or block_type not in ('HeroSection', 'NewsSection', 'EventsSection', 'BulletinsSection', 'MessageSection', 'DividerSection')
      or jsonb_typeof(block -> 'props') is distinct from 'object'
      or char_length(coalesce(block #>> '{props,title}', '')) > 120
      or char_length(coalesce(block #>> '{props,description}', '')) > 320
      or char_length(coalesce(block #>> '{props,summary}', '')) > 500
      or char_length(coalesce(block #>> '{props,eyebrow}', '')) > 60
      or char_length(coalesce(block #>> '{props,message}', '')) > 1200
      or coalesce(block #>> '{props,tone}', 'destacado') not in ('destacado', 'claro', 'oscuro')
      or coalesce(block #>> '{props,layout}', 'grilla') not in ('grilla', 'lista')
      or coalesce((block #>> '{props,limit}')::integer, 4) not between 1 and 12 then
      return false;
    end if;
  end loop;

  return true;
exception when others then
  return false;
end;
$function$;

create or replace function public.get_communications_site()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  can_manage boolean;
  state_row public.communications_site_state%rowtype;
begin
  if not public.user_can_view_communications() then
    raise exception 'Sin permisos para consultar el Portal de Comunicaciones';
  end if;
  can_manage := public.user_can_manage_communications();
  select * into state_row
  from public.communications_site_state
  where site_key = 'home';

  return jsonb_build_object(
    'can_manage', can_manage,
    'published_data', state_row.published_data,
    'published_version', state_row.published_version,
    'published_at', state_row.published_at,
    'draft_data', case when can_manage then state_row.draft_data else null end,
    'draft_revision', case when can_manage then state_row.draft_revision else null end,
    'versions', case when can_manage then coalesce((
      select jsonb_agg(jsonb_build_object(
        'version', version_row.version,
        'published_at', version_row.published_at,
        'published_by', version_row.published_by,
        'restored_from_version', version_row.restored_from_version
      ) order by version_row.version desc)
      from public.communications_site_versions version_row
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$function$;

create or replace function public.save_communications_site_draft(
  p_data jsonb,
  p_expected_revision integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_id uuid := auth.uid();
  next_revision integer;
begin
  if actor_id is null or not public.user_can_manage_communications() then
    raise exception 'Sin permisos para editar el diseño del portal';
  end if;
  if not public.is_valid_communications_site_data(p_data) then
    raise exception 'El diseño contiene bloques o propiedades no permitidos';
  end if;

  update public.communications_site_state state_row set
    draft_data = p_data,
    draft_revision = state_row.draft_revision + 1,
    draft_updated_by = actor_id,
    draft_updated_at = timezone('utc', now())
  where state_row.site_key = 'home'
    and state_row.draft_revision = p_expected_revision
  returning draft_revision into next_revision;

  if next_revision is null then
    raise exception 'El borrador cambió en otra sesión. Recarga para continuar.' using errcode = '40001';
  end if;
  return next_revision;
end;
$function$;

create or replace function public.publish_communications_site(p_expected_revision integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_id uuid := auth.uid();
  state_row public.communications_site_state%rowtype;
  next_version integer;
begin
  if actor_id is null or not public.user_can_manage_communications() then
    raise exception 'Sin permisos para publicar el diseño del portal';
  end if;
  select * into state_row
  from public.communications_site_state
  where site_key = 'home'
  for update;
  if state_row.draft_revision is null or state_row.draft_revision <> p_expected_revision then
    raise exception 'El borrador cambió en otra sesión. Recarga para publicar.' using errcode = '40001';
  end if;
  if not public.is_valid_communications_site_data(state_row.draft_data) then
    raise exception 'El diseño contiene bloques o propiedades no permitidos';
  end if;

  next_version := state_row.published_version + 1;
  insert into public.communications_site_versions (
    version, schema_version, data, published_by
  ) values (
    next_version, 1, state_row.draft_data, actor_id
  );
  update public.communications_site_state set
    published_data = state_row.draft_data,
    published_version = next_version,
    published_by = actor_id,
    published_at = timezone('utc', now())
  where site_key = 'home';
  return next_version;
end;
$function$;

create or replace function public.restore_communications_site_version(
  p_version integer,
  p_expected_revision integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_id uuid := auth.uid();
  state_row public.communications_site_state%rowtype;
  version_data jsonb;
  next_version integer;
begin
  if actor_id is null or not public.user_can_manage_communications() then
    raise exception 'Sin permisos para restaurar el diseño del portal';
  end if;
  select * into state_row
  from public.communications_site_state
  where site_key = 'home'
  for update;
  if state_row.draft_revision <> p_expected_revision then
    raise exception 'El borrador cambió en otra sesión. Recarga para restaurar.' using errcode = '40001';
  end if;
  select version_row.data into version_data
  from public.communications_site_versions version_row
  where version_row.version = p_version;
  if version_data is null or not public.is_valid_communications_site_data(version_data) then
    raise exception 'La versión seleccionada no está disponible';
  end if;

  next_version := state_row.published_version + 1;
  update public.communications_site_state set
    draft_data = version_data,
    draft_revision = draft_revision + 1,
    draft_updated_by = actor_id,
    draft_updated_at = timezone('utc', now()),
    published_data = version_data,
    published_version = next_version,
    published_by = actor_id,
    published_at = timezone('utc', now())
  where site_key = 'home';
  insert into public.communications_site_versions (
    version, schema_version, data, published_by, restored_from_version
  ) values (
    next_version, 1, version_data, actor_id, p_version
  );
  return next_version;
end;
$function$;

revoke all on function public.is_valid_communications_site_data(jsonb) from public, anon, authenticated;
revoke all on function public.get_communications_site() from public, anon;
revoke all on function public.save_communications_site_draft(jsonb, integer) from public, anon;
revoke all on function public.publish_communications_site(integer) from public, anon;
revoke all on function public.restore_communications_site_version(integer, integer) from public, anon;
grant execute on function public.get_communications_site() to authenticated;
grant execute on function public.save_communications_site_draft(jsonb, integer) to authenticated;
grant execute on function public.publish_communications_site(integer) to authenticated;
grant execute on function public.restore_communications_site_version(integer, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
