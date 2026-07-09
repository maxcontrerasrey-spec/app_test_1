begin;

revoke update on public.profiles from authenticated;

grant update (
  must_reset_password,
  updated_at
) on public.profiles to authenticated;

notify pgrst, 'reload schema';

commit;
