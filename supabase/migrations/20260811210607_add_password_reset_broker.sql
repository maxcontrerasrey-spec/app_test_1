begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.password_reset_rate_limits (
  scope_key text primary key,
  window_started_at timestamptz not null default timezone('utc', now()),
  request_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint password_reset_rate_limits_scope_key_check check (length(scope_key) between 10 and 140),
  constraint password_reset_rate_limits_request_count_check check (request_count >= 0)
);

alter table private.password_reset_rate_limits enable row level security;
revoke all on private.password_reset_rate_limits from public, anon, authenticated;
grant all on private.password_reset_rate_limits to service_role;

create or replace function private.claim_password_reset_request(
  p_email text,
  p_ip_address text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  normalized_ip text := nullif(trim(coalesce(p_ip_address, '')), '');
  now_utc timestamptz := timezone('utc', now());
  email_key text := 'email:' || md5(normalized_email);
  ip_key text := 'ip:' || md5(coalesce(normalized_ip, 'unknown'));
  email_count integer;
  ip_count integer;
begin
  if current_user <> 'service_role' then
    raise exception 'No autorizado';
  end if;

  if normalized_email = '' or position('@' in normalized_email) < 2 then
    return false;
  end if;

  insert into private.password_reset_rate_limits(scope_key, window_started_at, request_count, updated_at)
  values (email_key, now_utc, 1, now_utc)
  on conflict (scope_key) do update
    set request_count = case
      when private.password_reset_rate_limits.window_started_at <= now_utc - interval '1 hour' then 1
      else private.password_reset_rate_limits.request_count + 1
    end,
    window_started_at = case
      when private.password_reset_rate_limits.window_started_at <= now_utc - interval '1 hour' then now_utc
      else private.password_reset_rate_limits.window_started_at
    end,
    updated_at = now_utc
  returning request_count into email_count;

  if email_count > 5 then
    return false;
  end if;

  insert into private.password_reset_rate_limits(scope_key, window_started_at, request_count, updated_at)
  values (ip_key, now_utc, 1, now_utc)
  on conflict (scope_key) do update
    set request_count = case
      when private.password_reset_rate_limits.window_started_at <= now_utc - interval '1 hour' then 1
      else private.password_reset_rate_limits.request_count + 1
    end,
    window_started_at = case
      when private.password_reset_rate_limits.window_started_at <= now_utc - interval '1 hour' then now_utc
      else private.password_reset_rate_limits.window_started_at
    end,
    updated_at = now_utc
  returning request_count into ip_count;

  return ip_count <= 20;
end;
$function$;

revoke all on function private.claim_password_reset_request(text, text) from public, anon, authenticated;
grant execute on function private.claim_password_reset_request(text, text) to service_role;

create or replace function public.claim_password_reset_request(
  p_email text,
  p_ip_address text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if current_user <> 'service_role' then
    raise exception 'No autorizado';
  end if;
  return private.claim_password_reset_request(p_email, p_ip_address);
end;
$function$;

revoke all on function public.claim_password_reset_request(text, text) from public, anon, authenticated;
grant execute on function public.claim_password_reset_request(text, text) to service_role;

notify pgrst, 'reload schema';

commit;
