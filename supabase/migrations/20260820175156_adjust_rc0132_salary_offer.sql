-- Ajuste puntual solicitado para el folio RC-0132.
-- Es idempotente y falla si el valor vigente no coincide con lo confirmado.
do $$
declare
  v_request public.hiring_requests%rowtype;
  v_actor uuid := '0de4ef6f-3e52-4bab-8042-ab04ea7763ae'::uuid;
begin
  select *
    into v_request
    from public.hiring_requests
   where folio = '0132'
   for update;

  if not found then
    raise exception 'No existe el folio RC-0132';
  end if;

  if v_request.salary_offer = 1384000 then
    return;
  end if;

  if v_request.salary_offer <> 1345000 then
    raise exception 'El folio RC-0132 tiene una renta inesperada: %', v_request.salary_offer;
  end if;

  update public.hiring_requests
     set salary_offer = 1384000
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
    jsonb_build_object('salary_offer', 1384000),
    jsonb_build_object(
      'folio', v_request.folio,
      'reason', 'Ajuste solicitado de renta líquida ofrecida',
      'execution_mode', 'production_admin_adjustment'
    )
  );
end;
$$;
