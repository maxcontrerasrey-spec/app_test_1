-- Migration: Add update_candidate_driver_license security definer RPC
-- Created At: 2026-05-22

create or replace function public.update_candidate_driver_license(
  p_profile_id uuid,
  p_license_class text,
  p_license_expiry date
)
returns void
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

  -- check if user can manage at least one active recruitment case where this candidate is assigned
  select exists (
    select 1 
      from public.recruitment_case_candidates rcc
      join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
     where rcc.candidate_profile_id = p_profile_id
       and public.user_can_manage_recruitment_case(current_user_id, rc.id)
  ) into has_access;

  -- if not, check if user is admin
  if not has_access then
    select exists (
      select 1 
        from public.user_roles ur
        join public.app_roles ar on ar.id = ur.role_id
       where ur.user_id = current_user_id
         and ar.code = 'admin'
    ) into has_access;
  end if;

  if not has_access then
    raise exception 'Sin permisos para editar este perfil de candidato';
  end if;

  update public.candidate_profiles
  set
    driver_license_class = nullif(trim(p_license_class), ''),
    driver_license_expiry = p_license_expiry
  where id = p_profile_id;
end;
$function$;

-- Revoke all direct permissions to public/anon
revoke all on function public.update_candidate_driver_license(uuid, text, date) from public, anon;

-- Grant execution to authenticated users
grant execute on function public.update_candidate_driver_license(uuid, text, date) to authenticated;
