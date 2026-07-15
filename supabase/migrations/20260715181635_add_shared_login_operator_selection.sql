begin;

create table if not exists public.shared_login_operator_choices (
  id uuid primary key default gen_random_uuid(),
  login_email text not null,
  login_email_normalized text generated always as (lower(trim(login_email))) stored,
  operator_key text not null,
  operator_name text not null,
  operator_role text not null default 'supervisor',
  buk_employee_id text,
  document_number text,
  contract_code text,
  area_name text,
  area_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint shared_login_operator_choices_operator_key_format
    check (operator_key = lower(operator_key) and operator_key ~ '^[a-z0-9_]+$'),
  constraint shared_login_operator_choices_email_not_blank
    check (length(trim(login_email)) > 0),
  constraint shared_login_operator_choices_name_not_blank
    check (length(trim(operator_name)) > 0),
  constraint shared_login_operator_choices_unique_operator
    unique (login_email_normalized, operator_key)
);

create table if not exists public.shared_login_operator_selections (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references public.profiles (id) on delete cascade,
  login_email text not null,
  login_email_normalized text generated always as (lower(trim(login_email))) stored,
  operator_choice_id uuid not null references public.shared_login_operator_choices (id) on delete restrict,
  operator_key text not null,
  operator_name text not null,
  operator_role text not null,
  app_session_id text,
  user_agent text,
  selected_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_shared_login_operator_choices_email_active
  on public.shared_login_operator_choices (login_email_normalized, is_active);

create index if not exists idx_shared_login_operator_selections_user_selected
  on public.shared_login_operator_selections (auth_user_id, selected_at desc);

create index if not exists idx_shared_login_operator_selections_email_selected
  on public.shared_login_operator_selections (login_email_normalized, selected_at desc);

drop trigger if exists trg_shared_login_operator_choices_set_updated_at on public.shared_login_operator_choices;
create trigger trg_shared_login_operator_choices_set_updated_at
before update on public.shared_login_operator_choices
for each row
execute function public.set_updated_at();

alter table public.shared_login_operator_choices enable row level security;
alter table public.shared_login_operator_selections enable row level security;

drop policy if exists "shared_login_operator_choices_select_own_email" on public.shared_login_operator_choices;
create policy "shared_login_operator_choices_select_own_email"
on public.shared_login_operator_choices
for select
to authenticated
using (
  is_active = true
  and login_email_normalized = (
    select lower(trim(p.email))
    from public.profiles p
    where p.id = (select auth.uid())
  )
);

drop policy if exists "shared_login_operator_selections_select_own_user" on public.shared_login_operator_selections;
create policy "shared_login_operator_selections_select_own_user"
on public.shared_login_operator_selections
for select
to authenticated
using (auth_user_id = (select auth.uid()));

revoke all on public.shared_login_operator_choices from public, anon, authenticated;
revoke all on public.shared_login_operator_selections from public, anon, authenticated;
grant select on public.shared_login_operator_choices to authenticated;
grant select on public.shared_login_operator_selections to authenticated;

create or replace function public.get_shared_login_operator_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
begin
  if current_user_id is null then
    return '[]'::jsonb;
  end if;

  select p.email
  into current_email
  from public.profiles p
  where p.id = current_user_id
    and p.status = 'active';

  if current_email is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', choice.id,
          'operator_key', choice.operator_key,
          'operator_name', choice.operator_name,
          'operator_role', choice.operator_role,
          'buk_employee_id', choice.buk_employee_id,
          'document_number', choice.document_number,
          'contract_code', choice.contract_code,
          'area_name', choice.area_name,
          'area_code', choice.area_code
        )
        order by choice.operator_name
      )
      from public.shared_login_operator_choices choice
      where choice.is_active = true
        and choice.login_email_normalized = lower(trim(current_email))
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.select_shared_login_operator(
  p_operator_choice_id uuid,
  p_app_session_id text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  selected_choice public.shared_login_operator_choices%rowtype;
  selection_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.'
      using errcode = '28000';
  end if;

  select p.email
  into current_email
  from public.profiles p
  where p.id = current_user_id
    and p.status = 'active';

  if current_email is null then
    raise exception 'Perfil activo no encontrado.'
      using errcode = '28000';
  end if;

  select choice.*
  into selected_choice
  from public.shared_login_operator_choices choice
  where choice.id = p_operator_choice_id
    and choice.is_active = true
    and choice.login_email_normalized = lower(trim(current_email));

  if selected_choice.id is null then
    raise exception 'Operador no disponible para este usuario.'
      using errcode = '42501';
  end if;

  insert into public.shared_login_operator_selections (
    auth_user_id,
    login_email,
    operator_choice_id,
    operator_key,
    operator_name,
    operator_role,
    app_session_id,
    user_agent
  )
  values (
    current_user_id,
    current_email,
    selected_choice.id,
    selected_choice.operator_key,
    selected_choice.operator_name,
    selected_choice.operator_role,
    nullif(left(trim(coalesce(p_app_session_id, '')), 120), ''),
    nullif(left(trim(coalesce(p_user_agent, '')), 500), '')
  )
  returning id into selection_id;

  return jsonb_build_object(
    'selection_id', selection_id,
    'id', selected_choice.id,
    'operator_key', selected_choice.operator_key,
    'operator_name', selected_choice.operator_name,
    'operator_role', selected_choice.operator_role,
    'buk_employee_id', selected_choice.buk_employee_id,
    'document_number', selected_choice.document_number,
    'contract_code', selected_choice.contract_code,
    'area_name', selected_choice.area_name,
    'area_code', selected_choice.area_code
  );
end;
$$;

revoke all on function public.get_shared_login_operator_options() from public, anon;
grant execute on function public.get_shared_login_operator_options() to authenticated;

revoke all on function public.select_shared_login_operator(uuid, text, text) from public, anon;
grant execute on function public.select_shared_login_operator(uuid, text, text) to authenticated;

insert into public.shared_login_operator_choices (
  login_email,
  operator_key,
  operator_name,
  operator_role,
  buk_employee_id,
  document_number,
  contract_code,
  area_name,
  area_code,
  is_active
)
values
  (
    'supervisor.dmh@busesjm.com',
    'david_alvarez_alvarez',
    'David Edgardo Alvarez Alvarez',
    'supervisor',
    '17225',
    '13.748.498-6',
    '40114',
    'SERVICIO CODELCO DMH (6170400006:0004)',
    '401',
    true
  ),
  (
    'supervisor.dmh@busesjm.com',
    'sergio_alvarado_lopez',
    'Sergio Andres Alvarado Lopez',
    'supervisor',
    '14643',
    '15.571.664-9',
    '40114',
    'SERVICIO CODELCO DMH (6170400006:0004)',
    '401',
    true
  )
on conflict (login_email_normalized, operator_key) do update
set
  login_email = excluded.login_email,
  operator_name = excluded.operator_name,
  operator_role = excluded.operator_role,
  buk_employee_id = excluded.buk_employee_id,
  document_number = excluded.document_number,
  contract_code = excluded.contract_code,
  area_name = excluded.area_name,
  area_code = excluded.area_code,
  is_active = true,
  updated_at = timezone('utc', now());

notify pgrst, 'reload schema';

commit;
