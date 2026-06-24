begin;

create or replace view public.user_contracts
with (security_invoker = true, security_barrier = true)
as
select
  p.id as user_id,
  c.id as contract_id
from public.profiles p
cross join public.contracts c
where p.id = auth.uid()
  and p.status = 'active'
  and c.is_active = true
  and public.user_can_access_module(p.id, 'operaciones');

revoke all on public.user_contracts from public, anon;
grant select on public.user_contracts to authenticated;

drop function if exists public.create_hiring_request(
  date,
  bigint,
  text,
  integer,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  date,
  boolean,
  boolean,
  text,
  numeric,
  bigint,
  text,
  boolean
);

drop function if exists public.decide_hiring_request_approval(bigint, text, text);

notify pgrst, 'reload schema';

commit;
