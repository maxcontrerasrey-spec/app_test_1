begin;

revoke insert, update, delete on public.user_roles from authenticated;

notify pgrst, 'reload schema';

commit;
