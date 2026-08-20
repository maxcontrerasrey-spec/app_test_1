-- Ajuste puntual solicitado para el folio RC-0138.
-- Es idempotente: no vuelve a escribir si el valor ya fue ajustado.
alter table public.hiring_request_audit_log
  drop constraint if exists hiring_request_audit_log_action_type_check;

alter table public.hiring_request_audit_log
  add constraint hiring_request_audit_log_action_type_check
  check (
    action_type = any (
      array[
        'submitted'::text,
        'approval_created'::text,
        'approved'::text,
        'rejected'::text,
        'closed'::text,
        'salary_offer_adjusted'::text
      ]
    )
  );

do $$
declare
  v_request public.hiring_requests%rowtype;
  v_actor uuid := '0de4ef6f-3e52-4bab-8042-ab04ea7763ae'::uuid;
begin
  select *
    into v_request
    from public.hiring_requests
   where folio = '0138'
   for update;

  if not found then
    raise exception 'No existe el folio RC-0138';
  end if;

  if v_request.salary_offer = 1200000 then
    return;
  end if;

  if v_request.salary_offer <> 1037000 then
    raise exception 'El folio RC-0138 tiene una renta inesperada: %', v_request.salary_offer;
  end if;

  update public.hiring_requests
     set salary_offer = 1200000
   where id = v_request.id;

  insert into public.hiring_request_audit_log (
    hiring_request_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  ) values (
    v_request.id,
    v_actor,
    'salary_offer_adjusted',
    jsonb_build_object('salary_offer', v_request.salary_offer),
    jsonb_build_object('salary_offer', 1200000),
    jsonb_build_object(
      'folio', v_request.folio,
      'reason', 'Ajuste solicitado de renta líquida ofrecida',
      'execution_mode', 'production_admin_adjustment'
    )
  );
end;
$$;

notify pgrst, 'reload schema';
