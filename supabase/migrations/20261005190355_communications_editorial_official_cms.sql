-- EEES-DB-005: approved
-- owner: Comunicaciones / Engineering
-- rollback: ocultar los nuevos campos en UI; preservar niveles, acuses y referencias R2.

begin;

alter table public.communications_items
  add column if not exists channel text not null default 'editorial',
  add column if not exists publish_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists audience_role_codes text[] not null default '{}',
  add column if not exists requires_acknowledgement boolean not null default false,
  add column if not exists body_blocks jsonb not null default '[]'::jsonb,
  add column if not exists cover_asset_id uuid;

alter table public.communications_items
  drop constraint if exists communications_items_category_check,
  drop constraint if exists communications_items_channel_check,
  add constraint communications_items_category_check check (category in (
    'empresa', 'beneficios', 'personas', 'cultura', 'general',
    'operaciones', 'seguridad', 'reconocimientos', 'contratos',
    'equipos', 'actividades', 'campanas', 'aniversarios', 'hitos',
    'procedimientos', 'instrucciones'
  )),
  add constraint communications_items_channel_check check (channel in ('editorial', 'oficial')),
  add constraint communications_items_official_ack_check check (not requires_acknowledgement or channel = 'oficial'),
  add constraint communications_items_schedule_check check (expires_at is null or publish_at is null or expires_at > publish_at),
  add constraint communications_items_audience_size_check check (cardinality(audience_role_codes) <= 20),
  add constraint communications_items_body_blocks_check check (jsonb_typeof(body_blocks) = 'array' and jsonb_array_length(body_blocks) <= 100);

create index if not exists idx_communications_items_channel_window
  on public.communications_items (channel, status, publish_at, expires_at);
create index if not exists idx_communications_items_audience_roles
  on public.communications_items using gin (audience_role_codes);

create table if not exists public.communications_assets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.communications_items(id) on delete restrict,
  asset_type text not null check (asset_type in ('cover', 'image', 'video', 'attachment')),
  object_key text not null unique,
  filename text not null check (char_length(trim(filename)) between 1 and 180),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint communications_assets_object_key_check check (object_key ~ ('^communications/' || item_id::text || '/assets/[0-9a-f-]{36}\.[a-z0-9]{2,5}$')),
  constraint communications_assets_type_mime_check check (
    (asset_type in ('cover', 'image') and mime_type in ('image/jpeg', 'image/png', 'image/webp'))
    or (asset_type = 'video' and mime_type = 'video/mp4')
    or (asset_type = 'attachment' and mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
  )
);

create index if not exists idx_communications_assets_item on public.communications_assets (item_id, created_at);
alter table public.communications_assets enable row level security;
drop policy if exists communications_assets_no_direct_access on public.communications_assets;
create policy communications_assets_no_direct_access on public.communications_assets
  for all to authenticated using (false) with check (false);
revoke all on public.communications_assets from public, anon, authenticated;

create table if not exists public.communications_acknowledgements (
  item_id uuid not null references public.communications_items(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  acknowledged_at timestamptz not null default timezone('utc', now()),
  primary key (item_id, profile_id)
);
alter table public.communications_acknowledgements enable row level security;
drop policy if exists communications_acknowledgements_no_direct_access on public.communications_acknowledgements;
create policy communications_acknowledgements_no_direct_access on public.communications_acknowledgements
  for all to authenticated using (false) with check (false);
revoke all on public.communications_acknowledgements from public, anon, authenticated;

alter table public.communications_items
  add constraint communications_items_cover_asset_fk foreign key (cover_asset_id) references public.communications_assets(id) on delete set null;

create or replace function public.get_communications_portal()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_id uuid := auth.uid();
  can_manage boolean;
begin
  if actor_id is null or not public.user_can_view_communications() then
    raise exception 'Sin permisos para consultar el Portal de Comunicaciones';
  end if;

  can_manage := public.user_can_manage_communications();

  return jsonb_build_object(
    'can_manage', can_manage,
    'audiences', case when can_manage then coalesce((
      select jsonb_agg(jsonb_build_object('code', role_row.code, 'name', role_row.name) order by role_row.name)
      from public.app_roles role_row where role_row.is_active and role_row.code <> 'comunicador_'
    ), '[]'::jsonb) else '[]'::jsonb end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'content_type', item.content_type,
        'channel', item.channel,
        'title', item.title,
        'summary', item.summary,
        'body', item.body,
        'body_blocks', item.body_blocks,
        'category', item.category,
        'starts_at', item.starts_at,
        'ends_at', item.ends_at,
        'publish_at', item.publish_at,
        'expires_at', item.expires_at,
        'audience_role_codes', to_jsonb(item.audience_role_codes),
        'requires_acknowledgement', item.requires_acknowledgement,
        'has_acknowledged', exists (select 1 from public.communications_acknowledgements ack where ack.item_id = item.id and ack.profile_id = actor_id),
        'can_acknowledge', item.channel = 'oficial' and item.requires_acknowledgement and item.status = 'published'
          and coalesce(item.publish_at, item.published_at, item.created_at) <= timezone('utc', now())
          and (item.expires_at is null or item.expires_at > timezone('utc', now()))
          and (cardinality(item.audience_role_codes) = 0 or exists (
            select 1 from unnest(item.audience_role_codes) audience(role_code)
            where public.user_has_role(actor_id, audience.role_code)
          )),
        'acknowledgement_count', case when can_manage then (select count(*) from public.communications_acknowledgements ack where ack.item_id = item.id) else null end,
        'external_url', item.external_url,
        'is_featured', item.is_featured,
        'status', case
          when item.status = 'published' and item.expires_at is not null and item.expires_at <= timezone('utc', now()) then 'expired'
          when item.status = 'published' and item.publish_at is not null and item.publish_at > timezone('utc', now()) then 'scheduled'
          else item.status end,
        'has_pdf', item.r2_object_key is not null,
        'pdf_filename', item.r2_filename,
        'published_at', item.published_at,
        'created_at', item.created_at,
        'updated_at', item.updated_at,
        'cover_asset_id', item.cover_asset_id,
        'assets', coalesce((select jsonb_agg(jsonb_build_object(
          'id', asset.id, 'asset_type', asset.asset_type, 'filename', asset.filename,
          'mime_type', asset.mime_type, 'size_bytes', asset.size_bytes
        ) order by asset.created_at) from public.communications_assets asset where asset.item_id = item.id), '[]'::jsonb)
      ) order by item.is_featured desc, coalesce(item.publish_at, item.published_at, item.starts_at, item.created_at) desc, item.created_at desc)
      from public.communications_items item
      where can_manage or (
        item.status = 'published'
        and coalesce(item.publish_at, item.published_at, item.created_at) <= timezone('utc', now())
        and (item.expires_at is null or item.expires_at > timezone('utc', now()))
        and (cardinality(item.audience_role_codes) = 0 or exists (
          select 1 from unnest(item.audience_role_codes) audience(role_code)
          where public.user_has_role(actor_id, audience.role_code)
        ))
      )
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.save_communications_item(p_item_id uuid, p_content jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_id uuid := auth.uid();
  target_id uuid := coalesce(p_item_id, gen_random_uuid());
  content_type_value text := nullif(trim(p_content ->> 'content_type'), '');
  channel_value text := coalesce(nullif(p_content ->> 'channel', ''), 'editorial');
  title_value text := trim(coalesce(p_content ->> 'title', ''));
  summary_value text := trim(coalesce(p_content ->> 'summary', ''));
  category_value text := coalesce(nullif(p_content ->> 'category', ''), 'empresa');
  status_value text := coalesce(nullif(p_content ->> 'status', ''), 'draft');
  external_url_value text := nullif(trim(p_content ->> 'external_url'), '');
  role_codes text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_content -> 'audience_role_codes', '[]'::jsonb))), '{}');
  blocks_value jsonb := coalesce(p_content -> 'body_blocks', '[]'::jsonb);
  publish_at_value timestamptz := nullif(p_content ->> 'publish_at', '')::timestamptz;
  expires_at_value timestamptz := nullif(p_content ->> 'expires_at', '')::timestamptz;
  requires_ack_value boolean := coalesce((p_content ->> 'requires_acknowledgement')::boolean, false);
  cover_asset_value uuid := nullif(p_content ->> 'cover_asset_id', '')::uuid;
  published_at_value timestamptz;
begin
  if actor_id is null or not public.user_can_manage_communications() then
    raise exception 'Sin permisos para publicar en Comunicaciones';
  end if;
  if content_type_value not in ('noticia', 'comunicado', 'evento', 'boletin') then raise exception 'Tipo de publicación no válido'; end if;
  if channel_value not in ('editorial', 'oficial') then raise exception 'Nivel de publicación no válido'; end if;
  if requires_ack_value and channel_value <> 'oficial' then raise exception 'Solo las publicaciones oficiales pueden exigir acuse de lectura'; end if;
  if char_length(title_value) not between 3 and 160 or char_length(summary_value) not between 3 and 320 then raise exception 'El título o bajada no cumple el largo permitido'; end if;
  if category_value not in ('empresa','beneficios','personas','cultura','general','operaciones','seguridad','reconocimientos','contratos','equipos','actividades','campanas','aniversarios','hitos','procedimientos','instrucciones') then raise exception 'Categoría no válida'; end if;
  if (channel_value = 'oficial' and category_value not in ('seguridad','procedimientos','instrucciones','operaciones','general'))
    or (channel_value = 'editorial' and category_value in ('seguridad','procedimientos','instrucciones')) then raise exception 'La categoría no corresponde al nivel de publicación'; end if;
  if channel_value = 'oficial' and coalesce((p_content ->> 'is_featured')::boolean, false) then raise exception 'Las publicaciones oficiales no pueden ocupar el destacado editorial'; end if;
  if status_value not in ('draft', 'published', 'archived') then raise exception 'Estado de publicación no válido'; end if;
  if external_url_value is not null and external_url_value !~ '^https://' then raise exception 'Los enlaces externos deben usar HTTPS'; end if;
  if jsonb_typeof(blocks_value) is distinct from 'array' then raise exception 'El contenido enriquecido debe ser una lista de bloques'; end if;
  if jsonb_array_length(blocks_value) > 100
    or exists (select 1 from jsonb_array_elements(blocks_value) content_block where coalesce(content_block ->> 'type', '') not in ('paragraph', 'heading', 'quote', 'bullet_list', 'numbered_list', 'link'))
    or coalesce((select sum(char_length(coalesce(content_block ->> 'text', ''))) from jsonb_array_elements(blocks_value) content_block), 0) > 16000
    or exists (select 1 from jsonb_array_elements(blocks_value) content_block where content_block ->> 'type' = 'link' and coalesce(content_block ->> 'url', '') !~ '^https://') then
    raise exception 'El contenido enriquecido no cumple el formato permitido';
  end if;
  if cardinality(role_codes) > 20 or exists (
    select 1 from unnest(role_codes) role_code
    where not exists (select 1 from public.app_roles active_role where active_role.code = role_code and active_role.is_active and active_role.code <> 'comunicador_')
  ) then raise exception 'La audiencia contiene un rol no válido'; end if;
  if cardinality(role_codes) <> cardinality(array(select distinct role_code from unnest(role_codes) role_code)) then raise exception 'La audiencia contiene roles duplicados'; end if;
  if expires_at_value is not null and coalesce(publish_at_value, timezone('utc', now())) >= expires_at_value then raise exception 'El vencimiento debe ser posterior a la fecha de publicación'; end if;
  if cover_asset_value is not null and not exists (select 1 from public.communications_assets asset where asset.id = cover_asset_value and asset.item_id = target_id and asset.asset_type = 'cover') then raise exception 'La portada no pertenece a esta publicación'; end if;
  if cover_asset_value is not null and p_item_id is null then raise exception 'Primero guarda la publicación para agregar una portada'; end if;

  published_at_value := coalesce((select item.published_at from public.communications_items item where item.id = target_id), case when status_value = 'published' then timezone('utc', now()) else null end);

  insert into public.communications_items (
    id, content_type, title, summary, body, body_blocks, channel, category,
    starts_at, ends_at, publish_at, expires_at, audience_role_codes,
    requires_acknowledgement, cover_asset_id, external_url, is_featured, status,
    published_at, created_by, updated_by
  ) values (
    target_id, content_type_value, title_value, summary_value,
    left(coalesce(p_content ->> 'body', ''), 16000), blocks_value, channel_value, category_value,
    nullif(p_content ->> 'starts_at', '')::timestamptz,
    nullif(p_content ->> 'ends_at', '')::timestamptz,
    coalesce(publish_at_value, case when status_value = 'published' then timezone('utc', now()) else null end),
    expires_at_value, role_codes, requires_ack_value, cover_asset_value,
    external_url_value, coalesce((p_content ->> 'is_featured')::boolean, false),
    status_value, published_at_value, actor_id, actor_id
  ) on conflict (id) do update set
    content_type = excluded.content_type, title = excluded.title, summary = excluded.summary,
    body = excluded.body, body_blocks = excluded.body_blocks, channel = excluded.channel,
    category = excluded.category, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
    publish_at = excluded.publish_at, expires_at = excluded.expires_at,
    audience_role_codes = excluded.audience_role_codes,
    requires_acknowledgement = excluded.requires_acknowledgement,
    cover_asset_id = excluded.cover_asset_id, external_url = excluded.external_url,
    is_featured = excluded.is_featured, status = excluded.status,
    published_at = coalesce(public.communications_items.published_at, excluded.published_at),
    updated_by = excluded.updated_by;

  return target_id;
end;
$function$;

create or replace function public.can_upload_communications_asset(p_item_id uuid, p_asset_type text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $function$
  select auth.uid() is not null and public.user_can_manage_communications()
    and p_asset_type in ('cover', 'image', 'video', 'attachment')
    and exists (select 1 from public.communications_items item where item.id = p_item_id and item.status in ('draft', 'published', 'archived'));
$function$;

create or replace function public.attach_communications_asset(p_item_id uuid, p_asset_type text, p_object_key text, p_filename text, p_mime_type text, p_size_bytes bigint, p_sha256 text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare asset_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or not public.user_can_manage_communications() then raise exception 'Sin permisos para cargar archivos'; end if;
  if p_asset_type not in ('cover','image','video','attachment')
    or p_object_key !~ ('^communications/' || p_item_id::text || '/assets/[0-9a-f-]{36}\.[a-z0-9]{2,5}$')
    or char_length(trim(p_filename)) not between 1 and 180
    or p_size_bytes not between 1 and 52428800 or p_sha256 !~ '^[a-f0-9]{64}$'
    or not exists (select 1 from public.communications_items item where item.id = p_item_id and item.status in ('draft', 'published', 'archived')) then
    raise exception 'Referencia del archivo no válida';
  end if;
  insert into public.communications_assets (id, item_id, asset_type, object_key, filename, mime_type, size_bytes, sha256, created_by)
  values (asset_id, p_item_id, p_asset_type, p_object_key, trim(p_filename), p_mime_type, p_size_bytes, p_sha256, auth.uid());
  return asset_id;
end;
$function$;

create or replace function public.get_communications_asset(p_asset_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $function$
declare result jsonb;
begin
  if auth.uid() is null or not public.user_can_view_communications() then raise exception 'Sin permisos para consultar archivos'; end if;
  select jsonb_build_object('id', asset.id, 'item_id', asset.item_id, 'asset_type', asset.asset_type,
    'object_key', asset.object_key, 'filename', asset.filename, 'mime_type', asset.mime_type,
    'size_bytes', asset.size_bytes, 'sha256', asset.sha256)
  into result
  from public.communications_assets asset join public.communications_items item on item.id = asset.item_id
  where asset.id = p_asset_id and (public.user_can_manage_communications() or (
    item.status = 'published' and coalesce(item.publish_at, item.published_at, item.created_at) <= timezone('utc', now())
    and (item.expires_at is null or item.expires_at > timezone('utc', now()))
    and (cardinality(item.audience_role_codes) = 0 or exists (select 1 from unnest(item.audience_role_codes) role_code where public.user_has_role(auth.uid(), role_code)))
  ));
  if result is null then raise exception 'Archivo no disponible'; end if;
  return result;
end;
$function$;

create or replace function public.ack_communications_item(p_item_id uuid)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp
as $function$
declare actor_id uuid := auth.uid(); acknowledged timestamptz;
begin
  if actor_id is null or not public.user_can_view_communications() then raise exception 'Sin permisos para confirmar lectura'; end if;
  if not exists (select 1 from public.communications_items item where item.id = p_item_id
    and item.channel = 'oficial' and item.requires_acknowledgement and item.status = 'published'
    and coalesce(item.publish_at, item.published_at, item.created_at) <= timezone('utc', now())
    and (item.expires_at is null or item.expires_at > timezone('utc', now()))
    and (cardinality(item.audience_role_codes) = 0 or exists (select 1 from unnest(item.audience_role_codes) role_code where public.user_has_role(actor_id, role_code)))) then
    raise exception 'La publicación no requiere acuse o no está disponible para esta cuenta';
  end if;
  insert into public.communications_acknowledgements (item_id, profile_id) values (p_item_id, actor_id)
  on conflict (item_id, profile_id) do update set acknowledged_at = public.communications_acknowledgements.acknowledged_at
  returning acknowledged_at into acknowledged;
  return acknowledged;
end;
$function$;

revoke all on function public.get_communications_portal() from public, anon;
revoke all on function public.save_communications_item(uuid, jsonb) from public, anon;
revoke all on function public.can_upload_communications_asset(uuid, text) from public, anon;
revoke all on function public.attach_communications_asset(uuid, text, text, text, text, bigint, text) from public, anon;
revoke all on function public.get_communications_asset(uuid) from public, anon;
revoke all on function public.ack_communications_item(uuid) from public, anon;
grant execute on function public.get_communications_portal() to authenticated;
grant execute on function public.save_communications_item(uuid, jsonb) to authenticated;
grant execute on function public.can_upload_communications_asset(uuid, text) to authenticated;
grant execute on function public.attach_communications_asset(uuid, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.get_communications_asset(uuid) to authenticated;
grant execute on function public.ack_communications_item(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
