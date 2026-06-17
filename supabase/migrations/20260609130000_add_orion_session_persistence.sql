create table if not exists public.orion_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Nueva conversación',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.orion_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.orion_sessions (id) on delete cascade,
  sender text not null check (sender in ('user', 'ai')),
  content text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists orion_sessions_created_by_idx
  on public.orion_sessions (created_by, updated_at desc);

create index if not exists orion_messages_session_id_created_at_idx
  on public.orion_messages (session_id, created_at asc);

alter table public.orion_sessions enable row level security;
alter table public.orion_messages enable row level security;

grant select, insert, update, delete on public.orion_sessions to authenticated;
grant select, insert on public.orion_messages to authenticated;

drop policy if exists "orion_sessions_select_own" on public.orion_sessions;
create policy "orion_sessions_select_own"
on public.orion_sessions
for select
to authenticated
using (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "orion_sessions_insert_own" on public.orion_sessions;
create policy "orion_sessions_insert_own"
on public.orion_sessions
for insert
to authenticated
with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "orion_sessions_update_own" on public.orion_sessions;
create policy "orion_sessions_update_own"
on public.orion_sessions
for update
to authenticated
using (auth.uid() is not null and created_by = auth.uid())
with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "orion_sessions_delete_own" on public.orion_sessions;
create policy "orion_sessions_delete_own"
on public.orion_sessions
for delete
to authenticated
using (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "orion_messages_select_owned_session" on public.orion_messages;
create policy "orion_messages_select_owned_session"
on public.orion_messages
for select
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.orion_sessions session_row
    where session_row.id = orion_messages.session_id
      and session_row.created_by = auth.uid()
  )
);

drop policy if exists "orion_messages_insert_owned_session" on public.orion_messages;
create policy "orion_messages_insert_owned_session"
on public.orion_messages
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and exists (
    select 1
    from public.orion_sessions session_row
    where session_row.id = orion_messages.session_id
      and session_row.created_by = auth.uid()
  )
);
