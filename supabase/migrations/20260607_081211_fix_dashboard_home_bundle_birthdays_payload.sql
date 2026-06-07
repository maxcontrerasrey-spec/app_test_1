begin;

create or replace function public.get_dashboard_home_bundle(
  p_birthdays_limit integer default 6
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  control_payload jsonb := '{}'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  control_payload := coalesce(public.get_recruitment_control_dashboard_v2()::jsonb, '{}'::jsonb);

  return jsonb_build_object(
    'tasks_data',
    coalesce(public.get_dashboard_tasks(current_user_id)::jsonb, '[]'::jsonb),
    'approval_tracking_data',
    coalesce(public.get_dashboard_approval_tracking()::jsonb, '[]'::jsonb),
    'active_folios_data',
    coalesce(control_payload -> 'active_cases', '[]'::jsonb),
    'birthdays_data',
    coalesce(
      public.get_upcoming_birthdays(greatest(coalesce(p_birthdays_limit, 6), 1)),
      '[]'::jsonb
    )
  );
end;
$function$;

revoke all on function public.get_dashboard_home_bundle(integer) from public, anon;
grant execute on function public.get_dashboard_home_bundle(integer) to authenticated;

notify pgrst, 'reload schema';

commit;
