-- Migration: Add find_candidate_profile_by_rut security definer RPC
-- Created At: 2026-05-23

create or replace function public.find_candidate_profile_by_rut(
  p_national_id text
)
returns table (
  id uuid,
  national_id text,
  full_name text,
  email text,
  phone text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  has_access boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- Check if user is admin
  if public.user_is_admin(current_user_id) then
    has_access := true;
  end if;

  -- Check if user has recruitment role
  if not has_access then
    has_access := public.user_has_role(current_user_id, 'reclutamiento');
  end if;

  if not has_access then
    raise exception 'Sin permisos para buscar perfiles de candidatos';
  end if;

  return query
  select cp.id, cp.national_id, cp.full_name, cp.email, cp.phone
    from public.candidate_profiles cp
   where cp.national_id = trim(p_national_id)
   limit 1;
end;
$function$;

-- Revoke all direct permissions to public/anon
revoke all on function public.find_candidate_profile_by_rut(text) from public, anon;

-- Grant execution to authenticated users
grant execute on function public.find_candidate_profile_by_rut(text) to authenticated;
