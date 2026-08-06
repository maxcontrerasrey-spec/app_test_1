begin;

-- Compatibility for the currently deployed frontend: after Auth changes the
-- password, the auth.users trigger has already cleared the flag. The legacy
-- follow-up PATCH is allowed only as a no-op on an already-cleared row. A user
-- whose flag is still true cannot target the row through this UPDATE policy.
drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (
  public.user_is_admin(auth.uid())
  or (
    auth.uid() = id
    and must_reset_password = false
  )
)
with check (
  public.user_is_admin(auth.uid())
  or (
    auth.uid() = id
    and must_reset_password = false
  )
);

grant update (must_reset_password, updated_at) on public.profiles to authenticated;

notify pgrst, 'reload schema';

commit;
