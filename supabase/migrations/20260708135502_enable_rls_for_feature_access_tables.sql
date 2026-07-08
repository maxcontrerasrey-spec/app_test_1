begin;

alter table public.app_features enable row level security;
alter table public.role_feature_access enable row level security;

drop policy if exists "app_features_select_authenticated" on public.app_features;
create policy "app_features_select_authenticated"
on public.app_features
for select
to authenticated
using (is_active = true);

drop policy if exists "role_feature_access_select_authenticated" on public.role_feature_access;
create policy "role_feature_access_select_authenticated"
on public.role_feature_access
for select
to authenticated
using (true);

commit;
