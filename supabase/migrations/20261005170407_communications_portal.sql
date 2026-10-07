-- EEES-DB-005: approved
-- owner: Comunicaciones / Engineering
-- rollback: desactivar el módulo y preservar publicaciones y archivos R2; retirar objetos solo mediante una migración revisada.

begin;

insert into public.app_roles (code, name, description, is_active)
values (
  'comunicador_',
  'Comunicador',
  'Publica y mantiene noticias, comunicados, eventos y boletines corporativos.',
  true
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values (
  'portal_comunicaciones',
  'Portal de Comunicaciones',
  '/comunicaciones',
  'Noticias, comunicados, eventos y boletines corporativos.',
  67,
  true
)
on conflict (code) do update set
  name = excluded.name,
  route = excluded.route,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.role_module_access (role_code, module_code, can_view)
select role_row.code, 'portal_comunicaciones', true
from public.app_roles role_row
where role_row.is_active
on conflict (role_code, module_code) do update set can_view = true;

create table if not exists public.communications_items (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('noticia', 'comunicado', 'evento', 'boletin')),
  title text not null check (char_length(trim(title)) between 3 and 160),
  summary text not null check (char_length(trim(summary)) between 3 and 320),
  body text not null default '' check (char_length(body) <= 16000),
  category text not null default 'empresa' check (category in ('empresa', 'beneficios', 'personas', 'cultura', 'general')),
  starts_at timestamptz,
  ends_at timestamptz,
  external_url text,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  r2_object_key text,
  r2_filename text,
  r2_size_bytes bigint check (r2_size_bytes is null or r2_size_bytes between 1 and 20971520),
  r2_sha256 text check (r2_sha256 is null or r2_sha256 ~ '^[a-f0-9]{64}$'),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint communications_events_need_start check (content_type <> 'evento' or starts_at is not null or status <> 'published'),
  constraint communications_dates_order check (ends_at is null or starts_at is null or ends_at >= starts_at),
  constraint communications_external_https check (external_url is null or external_url ~ '^https://'),
  constraint communications_r2_fields_together check (
    (r2_object_key is null and r2_filename is null and r2_size_bytes is null and r2_sha256 is null)
    or
    (r2_object_key is not null and r2_filename is not null and r2_size_bytes is not null and r2_sha256 is not null)
  ),
  constraint communications_bulletin_pdf_required check (status <> 'published' or content_type <> 'boletin' or r2_object_key is not null)
);

create index if not exists idx_communications_items_published
  on public.communications_items (status, published_at desc, content_type);
create index if not exists idx_communications_items_events
  on public.communications_items (starts_at)
  where content_type = 'evento' and status = 'published';

alter table public.communications_items enable row level security;
drop policy if exists communications_items_no_direct_access on public.communications_items;
create policy communications_items_no_direct_access on public.communications_items
for all to authenticated using (false) with check (false);
revoke all on public.communications_items from public, anon, authenticated;

drop trigger if exists trg_communications_items_set_updated_at on public.communications_items;
create trigger trg_communications_items_set_updated_at
before update on public.communications_items
for each row execute function public.set_updated_at();

create or replace function public.user_can_view_communications()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select auth.uid() is not null
    and exists (
      select 1 from public.profiles profile_row
      where profile_row.id = auth.uid() and profile_row.status = 'active'
    );
$function$;

create or replace function public.user_can_manage_communications()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select auth.uid() is not null
    and exists (
      select 1 from public.profiles profile_row
      where profile_row.id = auth.uid()
        and profile_row.status = 'active'
        and (
          public.user_is_admin(auth.uid())
          or public.user_has_role(auth.uid(), 'comunicador_')
        )
    );
$function$;

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
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'content_type', item.content_type,
        'title', item.title,
        'summary', item.summary,
        'body', item.body,
        'category', item.category,
        'starts_at', item.starts_at,
        'ends_at', item.ends_at,
        'external_url', item.external_url,
        'is_featured', item.is_featured,
        'status', item.status,
        'has_pdf', item.r2_object_key is not null,
        'pdf_filename', item.r2_filename,
        'published_at', item.published_at,
        'created_at', item.created_at,
        'updated_at', item.updated_at
      ) order by item.is_featured desc, coalesce(item.published_at, item.starts_at, item.created_at) desc, item.created_at desc)
      from public.communications_items item
      where item.status = 'published' or can_manage
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.save_communications_item(
  p_item_id uuid,
  p_content jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_id uuid := auth.uid();
  target_id uuid := coalesce(p_item_id, gen_random_uuid());
  content_type_value text := nullif(trim(p_content ->> 'content_type'), '');
  title_value text := trim(coalesce(p_content ->> 'title', ''));
  summary_value text := trim(coalesce(p_content ->> 'summary', ''));
  category_value text := coalesce(nullif(p_content ->> 'category', ''), 'empresa');
  status_value text := coalesce(nullif(p_content ->> 'status', ''), 'draft');
  external_url_value text := nullif(trim(p_content ->> 'external_url'), '');
  published_at_value timestamptz;
begin
  if actor_id is null or not public.user_can_manage_communications() then
    raise exception 'Sin permisos para publicar en Comunicaciones';
  end if;
  if content_type_value not in ('noticia', 'comunicado', 'evento', 'boletin') then
    raise exception 'Tipo de publicación no válido';
  end if;
  if char_length(title_value) not between 3 and 160 or char_length(summary_value) not between 3 and 320 then
    raise exception 'El título o resumen no cumple el largo permitido';
  end if;
  if category_value not in ('empresa', 'beneficios', 'personas', 'cultura', 'general') then
    raise exception 'Categoría no válida';
  end if;
  if status_value not in ('draft', 'published', 'archived') then
    raise exception 'Estado de publicación no válido';
  end if;
  if external_url_value is not null and external_url_value !~ '^https://' then
    raise exception 'Los enlaces externos deben usar HTTPS';
  end if;
  published_at_value := coalesce(
    (select item.published_at from public.communications_items item where item.id = target_id),
    case when status_value = 'published' then timezone('utc', now()) else null end
  );

  insert into public.communications_items (
    id, content_type, title, summary, body, category, starts_at, ends_at,
    external_url, is_featured, status, published_at, created_by, updated_by
  ) values (
    target_id,
    content_type_value,
    title_value,
    summary_value,
    left(coalesce(p_content ->> 'body', ''), 16000),
    category_value,
    nullif(p_content ->> 'starts_at', '')::timestamptz,
    nullif(p_content ->> 'ends_at', '')::timestamptz,
    external_url_value,
    coalesce((p_content ->> 'is_featured')::boolean, false),
    status_value,
    published_at_value,
    actor_id,
    actor_id
  )
  on conflict (id) do update set
    content_type = excluded.content_type,
    title = excluded.title,
    summary = excluded.summary,
    body = excluded.body,
    category = excluded.category,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    external_url = excluded.external_url,
    is_featured = excluded.is_featured,
    status = excluded.status,
    published_at = coalesce(public.communications_items.published_at, excluded.published_at),
    updated_by = excluded.updated_by;

  return target_id;
end;
$function$;

create or replace function public.attach_communications_pdf(
  p_item_id uuid,
  p_object_key text,
  p_filename text,
  p_size_bytes bigint,
  p_sha256 text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.user_can_manage_communications() then
    raise exception 'Sin permisos para cargar boletines';
  end if;
  if p_object_key !~ ('^communications/' || p_item_id::text || '/[0-9a-f-]{36}\.pdf$')
    or p_size_bytes not between 1 and 20971520
    or p_sha256 !~ '^[a-f0-9]{64}$'
    or char_length(trim(p_filename)) not between 1 and 180 then
    raise exception 'Referencia documental no válida';
  end if;

  update public.communications_items item set
    r2_object_key = p_object_key,
    r2_filename = trim(p_filename),
    r2_size_bytes = p_size_bytes,
    r2_sha256 = p_sha256,
    updated_by = actor_id
  where item.id = p_item_id
    and item.content_type = 'boletin'
    and item.status = 'draft'
    and item.r2_object_key is null;

  if not found then
    raise exception 'El boletín debe estar en borrador y sin un archivo asociado';
  end if;
end;
$function$;

create or replace function public.can_upload_communications_pdf(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select auth.uid() is not null
    and public.user_can_manage_communications()
    and exists (
      select 1
      from public.communications_items item
      where item.id = p_item_id
        and item.content_type = 'boletin'
        and item.status = 'draft'
        and item.r2_object_key is null
    );
$function$;

create or replace function public.get_communications_pdf(p_item_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.user_can_view_communications() then
    raise exception 'Sin permisos para descargar este boletín';
  end if;

  select jsonb_build_object(
    'object_key', item.r2_object_key,
    'filename', item.r2_filename,
    'size_bytes', item.r2_size_bytes,
    'sha256', item.r2_sha256
  ) into result
  from public.communications_items item
  where item.id = p_item_id
    and item.content_type = 'boletin'
    and item.r2_object_key is not null
    and (item.status = 'published' or public.user_can_manage_communications());

  if result is null then
    raise exception 'Boletín no disponible';
  end if;
  return result;
end;
$function$;

revoke all on function public.user_can_view_communications() from public, anon;
revoke all on function public.user_can_manage_communications() from public, anon;
revoke all on function public.get_communications_portal() from public, anon;
revoke all on function public.save_communications_item(uuid, jsonb) from public, anon;
revoke all on function public.attach_communications_pdf(uuid, text, text, bigint, text) from public, anon;
revoke all on function public.can_upload_communications_pdf(uuid) from public, anon;
revoke all on function public.get_communications_pdf(uuid) from public, anon;

grant execute on function public.user_can_view_communications() to authenticated;
grant execute on function public.user_can_manage_communications() to authenticated;
grant execute on function public.get_communications_portal() to authenticated;
grant execute on function public.save_communications_item(uuid, jsonb) to authenticated;
grant execute on function public.attach_communications_pdf(uuid, text, text, bigint, text) to authenticated;
grant execute on function public.can_upload_communications_pdf(uuid) to authenticated;
grant execute on function public.get_communications_pdf(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
