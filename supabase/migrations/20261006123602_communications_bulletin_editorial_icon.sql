-- EEES-DB-005: approved
-- owner: Comunicaciones / Engineering
-- rollback: ocultar icono configurado; conservar valores por defecto y contenido existente.

begin;

alter table public.communications_items
  add column if not exists icon_key text not null default 'download';

alter table public.communications_items
  drop constraint if exists communications_items_icon_key_check,
  add constraint communications_items_icon_key_check check (icon_key in (
    'megaphone', 'clipboard-list', 'calendar-clock', 'users', 'bus', 'award', 'sparkles', 'download'
  ));

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
        'icon_key', item.icon_key,
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
  icon_key_value text := coalesce(nullif(p_content ->> 'icon_key', ''), 'download');
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
  if icon_key_value not in ('megaphone', 'clipboard-list', 'calendar-clock', 'users', 'bus', 'award', 'sparkles', 'download') then raise exception 'Icono de publicación no válido'; end if;
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
    id, content_type, title, summary, icon_key, body, body_blocks, channel, category,
    starts_at, ends_at, publish_at, expires_at, audience_role_codes,
    requires_acknowledgement, cover_asset_id, external_url, is_featured, status,
    published_at, created_by, updated_by
  ) values (
    target_id, content_type_value, title_value, summary_value, icon_key_value,
    left(coalesce(p_content ->> 'body', ''), 16000), blocks_value, channel_value, category_value,
    nullif(p_content ->> 'starts_at', '')::timestamptz,
    nullif(p_content ->> 'ends_at', '')::timestamptz,
    coalesce(publish_at_value, case when status_value = 'published' then timezone('utc', now()) else null end),
    expires_at_value, role_codes, requires_ack_value, cover_asset_value,
    external_url_value, coalesce((p_content ->> 'is_featured')::boolean, false),
    status_value, published_at_value, actor_id, actor_id
  ) on conflict (id) do update set
    content_type = excluded.content_type, title = excluded.title, summary = excluded.summary, icon_key = excluded.icon_key,
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

notify pgrst, 'reload schema';

commit;
