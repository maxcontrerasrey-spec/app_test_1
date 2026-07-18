begin;

drop function if exists public.upsert_accreditation_requirement(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  integer,
  boolean,
  integer,
  boolean
);

notify pgrst, 'reload schema';

commit;
