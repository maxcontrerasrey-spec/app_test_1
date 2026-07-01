begin;

insert into public.job_positions (code, name, is_active)
values ('CARGO-090', 'CONDUCTOR MINIBUS ACERCAMIENTO', true)
on conflict (name)
do update set
  is_active = true,
  updated_at = timezone('utc', now());

notify pgrst, 'reload schema';

commit;
