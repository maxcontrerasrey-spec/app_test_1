begin;

create table if not exists public.competency_legal_signers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null unique,
  full_name text not null,
  role_label text not null,
  document_number text,
  signature_asset_key text not null,
  signature_sha256 text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  valid_from date not null default current_date,
  valid_until date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint competency_legal_signers_hash_format check (signature_sha256 is null or signature_sha256 ~ '^[a-f0-9]{64}$')
);

insert into public.competency_legal_signers (
  user_id,
  email,
  full_name,
  role_label,
  signature_asset_key,
  metadata
)
select
  p.id,
  'guillermo.zanartu@busesjm.com',
  'Guillermo Zañartu Apara',
  'Representante Legal',
  'guillermo-zanartu-apara-v1',
  jsonb_build_object('source', 'competency_legal_signature_workflow', 'run_source', 'buk_employee_snapshot')
from public.profiles p
where lower(trim(p.email)) = 'guillermo.zanartu@busesjm.com'
on conflict (email) do update
set user_id = excluded.user_id,
    full_name = excluded.full_name,
    role_label = excluded.role_label,
    signature_asset_key = excluded.signature_asset_key,
    updated_at = timezone('utc', now());

insert into public.competency_legal_signers (
  email,
  full_name,
  role_label,
  signature_asset_key,
  metadata
)
select
  'guillermo.zanartu@busesjm.com',
  'Guillermo Zañartu Apara',
  'Representante Legal',
  'guillermo-zanartu-apara-v1',
  jsonb_build_object('source', 'competency_legal_signature_workflow', 'run_source', 'buk_employee_snapshot')
where not exists (
  select 1 from public.competency_legal_signers where email = 'guillermo.zanartu@busesjm.com'
);

alter table public.competency_certificates
  add column if not exists legal_signature_required boolean not null default false,
  add column if not exists legal_approval_status text not null default 'not_required',
  add column if not exists legal_signer_id uuid references public.competency_legal_signers(id) on delete restrict,
  add column if not exists legal_approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists legal_approved_at timestamptz,
  add column if not exists legal_rejection_reason text,
  add column if not exists legal_signature_sha256 text,
  add column if not exists legal_signature_signed_at timestamptz,
  add column if not exists legal_signer_document_number text;

alter table public.competency_certificates
  drop constraint if exists competency_certificates_legal_approval_status_check;
alter table public.competency_certificates
  add constraint competency_certificates_legal_approval_status_check
  check (legal_approval_status in ('not_required', 'pending', 'approved', 'rejected'));

alter table public.competency_certificates
  drop constraint if exists competency_certificates_legal_signature_hash_format;
alter table public.competency_certificates
  add constraint competency_certificates_legal_signature_hash_format
  check (legal_signature_sha256 is null or legal_signature_sha256 ~ '^[a-f0-9]{64}$');

create index if not exists idx_competency_certificates_legal_approval
  on public.competency_certificates(legal_approval_status, legal_signer_id, created_at desc);

create or replace function public.competency_requires_legal_signature(
  area_name_input text,
  contract_code_input text
)
returns boolean
language sql
immutable
as $function$
  select
    lower(regexp_replace(trim(coalesce(area_name_input, '')), '[^a-z0-9]+', '-', 'g')) in ('codelco-dsal', 'codelco-dsal-el-salvador', 'codelco-el-salvador')
    or lower(regexp_replace(trim(coalesce(contract_code_input, '')), '[^a-z0-9:]+', '', 'g')) in ('6170400011:0001', '0000000170:0001');
$function$;

create or replace function public.user_can_approve_competency_legal_signature(requested_signer_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  signer_user_id uuid;
begin
  if current_user_id is null or requested_signer_id is null then
    return false;
  end if;

  if public.user_is_admin(current_user_id) then
    return true;
  end if;

  select user_id into signer_user_id
  from public.competency_legal_signers
  where id = requested_signer_id
    and status = 'active'
    and (valid_until is null or valid_until >= current_date);

  return signer_user_id = current_user_id;
end;
$function$;

create or replace function public.set_competency_legal_signature_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  request_record record;
  signer_record record;
begin
  select worker_area_name, worker_contract_code into request_record
  from public.competency_requests
  where id = new.request_id;

  if public.competency_requires_legal_signature(request_record.worker_area_name, request_record.worker_contract_code) then
    select * into signer_record
    from public.competency_legal_signers
    where email = 'guillermo.zanartu@busesjm.com'
      and status = 'active'
      and (valid_until is null or valid_until >= current_date)
    order by updated_at desc
    limit 1;

    if signer_record.id is null then
      raise exception 'No existe un firmante legal activo configurado para Codelco El Salvador';
    end if;

    new.legal_signature_required := true;
    new.legal_approval_status := 'pending';
    new.legal_signer_id := signer_record.id;
  else
    new.legal_signature_required := false;
    new.legal_approval_status := 'not_required';
    new.legal_signer_id := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_competency_certificates_legal_signature_scope on public.competency_certificates;
create trigger trg_competency_certificates_legal_signature_scope
before insert on public.competency_certificates
for each row execute function public.set_competency_legal_signature_scope();

create or replace function public.get_competency_legal_approval_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sesion requerida';
  end if;

  if not public.user_is_admin(current_user_id) and not exists (
    select 1
    from public.competency_legal_signers s
    where s.user_id = current_user_id
      and s.status = 'active'
      and (s.valid_until is null or s.valid_until >= current_date)
  ) then
    return '[]'::jsonb;
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'certificate_id', cc.id,
      'request_id', cr.id,
      'folio', cc.folio,
      'worker_full_name', cr.worker_full_name,
      'worker_document_number', cr.worker_document_number,
      'worker_job_title', cr.worker_job_title,
      'worker_area_name', cr.worker_area_name,
      'worker_contract_code', cr.worker_contract_code,
      'instructor_full_name', ci.full_name,
      'training_date', cr.training_date,
      'legal_approval_status', cc.legal_approval_status,
      'legal_signer_name', cls.full_name,
      'legal_signer_role', cls.role_label,
      'legal_signer_document_number', cls.document_number,
      'created_at', cc.created_at
    ) order by cc.created_at), '[]'::jsonb)
    from public.competency_certificates cc
    join public.competency_requests cr on cr.id = cc.request_id
    join public.competency_instructors ci on ci.id = cr.instructor_id
    join public.competency_legal_signers cls on cls.id = cc.legal_signer_id
    where cc.legal_signature_required = true
      and cc.legal_approval_status = 'pending'
      and (public.user_is_admin(current_user_id) or public.user_can_approve_competency_legal_signature(cls.id))
  );
end;
$function$;

create or replace function public.decide_competency_legal_approval(
  certificate_id_input uuid,
  decision_input text,
  rejection_reason_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  certificate_record record;
  normalized_decision text := lower(trim(coalesce(decision_input, '')));
begin
  if normalized_decision not in ('approved', 'rejected') then
    raise exception 'Decision legal invalida';
  end if;

  select cc.*, cls.full_name as signer_name
    into certificate_record
  from public.competency_certificates cc
  join public.competency_legal_signers cls on cls.id = cc.legal_signer_id
  where cc.id = certificate_id_input
    and cc.legal_signature_required = true
  for update;

  if certificate_record.id is null then
    raise exception 'Certificado no requiere aprobacion legal';
  end if;

  if not public.user_can_approve_competency_legal_signature(certificate_record.legal_signer_id) then
    raise exception 'Solo el Representante Legal asignado o un administrador puede decidir esta aprobacion';
  end if;

  if certificate_record.legal_approval_status <> 'pending' then
    raise exception 'La aprobacion legal ya fue resuelta';
  end if;

  if normalized_decision = 'rejected' and nullif(trim(coalesce(rejection_reason_input, '')), '') is null then
    raise exception 'Debes indicar el motivo del rechazo legal';
  end if;

  update public.competency_certificates
  set legal_approval_status = normalized_decision,
      legal_approved_by = current_user_id,
      legal_approved_at = timezone('utc', now()),
      legal_rejection_reason = case when normalized_decision = 'rejected' then nullif(trim(rejection_reason_input), '') else null end,
      updated_at = timezone('utc', now())
  where id = certificate_id_input;

  perform public.log_competency_event(
    certificate_record.request_id,
    certificate_id_input,
    case when normalized_decision = 'approved' then 'legal_signature_approved' else 'legal_signature_rejected' end,
    case when normalized_decision = 'approved' then 'Firma legal aprobada' else 'Firma legal rechazada' end,
    jsonb_build_object('decision', normalized_decision, 'signer_name', certificate_record.signer_name, 'reason', rejection_reason_input)
  );

  return jsonb_build_object('certificate_id', certificate_id_input, 'status', normalized_decision);
end;
$function$;

alter table public.competency_legal_signers enable row level security;
revoke all on public.competency_legal_signers from public, anon, authenticated;
revoke all on function public.competency_requires_legal_signature(text, text) from public, anon;
revoke all on function public.user_can_approve_competency_legal_signature(uuid) from public, anon;
revoke all on function public.set_competency_legal_signature_scope() from public, anon, authenticated;
revoke all on function public.get_competency_legal_approval_queue() from public, anon;
revoke all on function public.decide_competency_legal_approval(uuid, text, text) from public, anon;
grant execute on function public.competency_requires_legal_signature(text, text) to authenticated;
grant execute on function public.user_can_approve_competency_legal_signature(uuid) to authenticated;
grant execute on function public.get_competency_legal_approval_queue() to authenticated;
grant execute on function public.decide_competency_legal_approval(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
