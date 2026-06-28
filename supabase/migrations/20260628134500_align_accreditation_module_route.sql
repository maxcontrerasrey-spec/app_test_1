begin;

update public.app_modules
set
  route = '/recursos-humanos/acreditacion/dashboard',
  updated_at = timezone('utc', now())
where code = 'acreditacion_personas'
  and route is distinct from '/recursos-humanos/acreditacion/dashboard';

notify pgrst, 'reload schema';

commit;
