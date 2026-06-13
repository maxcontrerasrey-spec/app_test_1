begin;

create or replace function public.user_can_manage_hr_incentives(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.is_super_admin = true
  );
$$;

create or replace function public.user_can_view_hr_incentive_analytics(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.is_super_admin = true
  );
$$;

create or replace function public.user_can_manage_hr_roster(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and p.is_super_admin = true
  );
$$;

notify pgrst, 'reload schema';

commit;
