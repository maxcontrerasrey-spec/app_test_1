-- EEES-DB-005: approved
-- owner: Comunicaciones / Engineering
-- rollback: existing event layouts default to the previous horizontal list when the layout property is absent.

begin;

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

  if coalesce(p_data #>> '{root,props,theme}', '') not in ('buses-jm', 'andino', 'neutro', 'oceano', 'energia')
    or coalesce(p_data #>> '{root,props,font}', '') not in ('institucional', 'sistema', 'editorial')
    or coalesce(p_data #>> '{root,props,typeScale}', 'estandar') not in ('compacta', 'estandar', 'amplia')
    or coalesce(p_data #>> '{root,props,contentWidth}', 'estandar') not in ('estandar', 'amplio')
    or coalesce(p_data #>> '{root,props,shape}', 'suave') not in ('recta', 'suave', 'redondeada')
    or char_length(coalesce(p_data #>> '{root,props,title}', '')) not between 2 and 60
    or char_length(coalesce(p_data #>> '{root,props,tagline}', '')) > 180
    or char_length(coalesce(p_data #>> '{root,props,footer}', '')) > 180 then
    return false;
  end if;

  for block in select value from jsonb_array_elements(p_data -> 'content') loop
    block_type := block ->> 'type';
    if block_type is null
      or block_type not in ('HeroSection', 'FeaturedSection', 'NewsSection', 'EventsSection', 'BulletinsSection', 'MessageSection', 'DividerSection')
      or jsonb_typeof(block -> 'props') is distinct from 'object'
      or char_length(coalesce(block #>> '{props,title}', '')) > 120
      or char_length(coalesce(block #>> '{props,description}', '')) > 320
      or char_length(coalesce(block #>> '{props,summary}', '')) > 500
      or char_length(coalesce(block #>> '{props,eyebrow}', '')) > 60
      or char_length(coalesce(block #>> '{props,message}', '')) > 1200
      or coalesce(block #>> '{props,tone}', 'destacado') not in ('destacado', 'claro', 'oscuro')
      or (block_type = 'EventsSection' and coalesce(block #>> '{props,layout}', 'lista') not in ('lista', 'tarjetas-2', 'tarjetas-3'))
      or (block_type <> 'EventsSection' and coalesce(block #>> '{props,layout}', 'grilla') not in ('grilla', 'lista'))
      or coalesce((block #>> '{props,limit}')::integer, 4) not between 1 and 12 then
      return false;
    end if;
  end loop;

  return true;
exception when others then
  return false;
end;
$function$;

revoke all on function public.is_valid_communications_site_data(jsonb) from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
